import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewQuestions, interviewSessions, interviewTurns, jobRequirements, jobs, mockScores } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { nextMockInterviewerTurn, scoreMockAnswer } from "@/lib/ai/mock-interviewer";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";
import { getUserFacts, getUserStories, resolveResumeId } from "@/lib/facts";
import { startJob } from "@/lib/jobs";

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
  const config = (session.configJson || {}) as {
    interviewType?: string;
    difficulty?: string;
    useJobDescription?: boolean;
    useResume?: boolean;
    verifiedOnly?: boolean;
  };

  // The setup screen's "Use Job Description" / "Use My Resume" toggles were
  // being stored and then ignored - the interviewer only ever saw the job
  // title. Feed it the real posting, the real requirements (including where
  // this candidate is weak), the verified background, and the questions
  // already predicted for this role, so practising here rehearses the
  // interview they are actually walking into.
  const useJd = config.useJobDescription !== false;
  const useResume = config.useResume !== false;

  const requirements =
    useJd && session.jobId
      ? db
          .select()
          .from(jobRequirements)
          .where(eq(jobRequirements.jobId, session.jobId))
          .all()
          .map((r) => ({
            requirement: r.requirement,
            priority: r.priority || "required",
            candidateMatch: r.candidateMatch,
          }))
      : [];

  const likelyQuestions =
    session.jobId
      ? db
          .select()
          .from(interviewQuestions)
          .where(eq(interviewQuestions.jobId, session.jobId))
          .all()
          .map((q) => q.question)
      : [];

  let candidateSummary: string | null = null;
  if (useResume) {
    const verifiedOnly = config.verifiedOnly !== false;
    const facts = getUserFacts(user.id, {
      jobId: session.jobId,
      resumeId: resolveResumeId(user.id, job?.resumeId),
    }).filter(
      (f) => !verifiedOnly || f.verificationStatus.startsWith("verified_") || f.verificationStatus === "transferable"
    );
    const stories = getUserStories(user.id, session.jobId);
    const factLines = facts
      .slice(0, 70)
      .map((f) => `- (${f.factType}) ${f.factValue}`)
      .join("\n");
    const storyLines = stories
      .map((st) => `- ${st.title}${st.metrics ? ` (${st.metrics})` : ""}`)
      .join("\n");
    candidateSummary = [factLines && `FACTS:\n${factLines}`, storyLines && `CAREER STORIES:\n${storyLines}`]
      .filter(Boolean)
      .join("\n\n");
  }

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
    // Score the previous answer in the background.
    //
    // Scoring only feeds the post-interview report - the conversation does not
    // need it to continue. Awaiting it here put a second model call in front of
    // every question, so the interviewer took ~12 seconds to come back. Nobody
    // sits in silence that long in a real interview.
    if (candidateTurn && body.lastQuestion) {
      const turnId = candidateTurn.id;
      const question: string = body.lastQuestion;
      const answer: string = body.candidateAnswer;
      const jobTitle = job?.jobTitle;
      startJob(
        `score:${turnId}`,
        "Scoring answer",
        async () => {
          const sc = await scoreMockAnswer(question, answer, jobTitle);
          db.insert(mockScores)
            .values({
              sessionId: id,
              interviewTurnId: turnId,
              relevanceScore: sc.relevance_score,
              clarityScore: sc.clarity_score,
              starScore: sc.star_score,
              metricsScore: sc.metrics_score,
              concisenessScore: sc.conciseness_score,
              jobAlignmentScore: sc.job_alignment_score,
              feedbackJson: sc.feedback,
            })
            .run();
        },
        () => {
          // Scoring is best-effort; a missing score costs one row in the
          // report, and must never interrupt the interview.
        }
      );
    }

    const nextTurn = await nextMockInterviewerTurn({
      difficulty: config.difficulty || "realistic",
      interviewType: config.interviewType || "behavioral",
      jobTitle: job?.jobTitle,
      company: job?.company,
      jobDescription: useJd ? job?.jobDescriptionRaw ?? null : null,
      requirements,
      candidateSummary,
      interviewer: job
        ? { name: job.interviewerName, role: job.interviewerRole, notes: job.interviewerNotes }
        : undefined,
      likelyQuestions,
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

    return NextResponse.json({ interviewerTurn, shouldEnd: nextTurn.should_end });
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
