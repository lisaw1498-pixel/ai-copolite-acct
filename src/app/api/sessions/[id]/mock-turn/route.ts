import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, interviewTurns, jobs, mockScores } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { nextMockInterviewerTurn, scoreMockAnswer } from "@/lib/ai/mock-interviewer";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;
  const config = (session.configJson || {}) as { interviewType?: string; difficulty?: string };

  let candidateTurn = null;
  if (body.candidateAnswer?.trim()) {
    candidateTurn = db
      .insert(interviewTurns)
      .values({
        sessionId: id,
        speaker: "candidate",
        rawTranscript: body.candidateAnswer,
        cleanedTranscript: body.candidateAnswer,
      })
      .returning()
      .get();
  }

  const transcript = db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, id))
    .orderBy(asc(interviewTurns.timestamp))
    .all()
    .map((t) => ({ speaker: t.speaker, text: t.cleanedTranscript || t.rawTranscript || "" }));

  try {
    let score = null;
    if (candidateTurn && body.lastQuestion) {
      try {
        const s = await scoreMockAnswer(body.lastQuestion, body.candidateAnswer, job?.jobTitle);
        score = db
          .insert(mockScores)
          .values({
            sessionId: id,
            interviewTurnId: candidateTurn.id,
            relevanceScore: s.relevance_score,
            clarityScore: s.clarity_score,
            starScore: s.star_score,
            metricsScore: s.metrics_score,
            concisenessScore: s.conciseness_score,
            jobAlignmentScore: s.job_alignment_score,
            feedbackJson: s.feedback,
          })
          .returning()
          .get();
      } catch {
        // Scoring is best-effort; don't block the interviewer's next turn.
      }
    }

    const nextTurn = await nextMockInterviewerTurn({
      difficulty: config.difficulty || "realistic",
      interviewType: config.interviewType || "behavioral",
      jobTitle: job?.jobTitle,
      company: job?.company,
      transcript,
    });

    const interviewerTurn = db
      .insert(interviewTurns)
      .values({
        sessionId: id,
        speaker: "ai_interviewer",
        rawTranscript: nextTurn.message,
        cleanedTranscript: nextTurn.message,
        questionDetected: true,
        questionCategory: nextTurn.question_category,
        isFollowUp: nextTurn.is_follow_up,
      })
      .returning()
      .get();

    return NextResponse.json({ interviewerTurn, score, shouldEnd: nextTurn.should_end });
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    // Surface the underlying cause: a bare message here is impossible to act
    // on, and this path already swallowed one silent failure.
    console.error("mock-turn failed:", err);
    return NextResponse.json(
      {
        error: "Couldn't continue the mock interview right now.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
