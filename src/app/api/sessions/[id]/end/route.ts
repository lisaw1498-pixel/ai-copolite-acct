import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, interviewTurns, jobs, mockScores, postInterviewReports } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { generatePostInterviewReport, generateThankYouEmail } from "@/lib/ai/post-interview";
import { jobKeys, startJob } from "@/lib/jobs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

  const scores = db.select().from(mockScores).where(eq(mockScores.sessionId, id)).all();
  const overall =
    scores.length > 0
      ? scores.reduce((sum, s) => {
          const vals = [s.relevanceScore, s.clarityScore, s.starScore, s.metricsScore, s.concisenessScore, s.jobAlignmentScore].filter(
            (v): v is number => typeof v === "number"
          );
          return sum + vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        }, 0) / scores.length
      : null;

  // Only stamp the end time once. This endpoint doubles as the retry path for
  // a failed report, and re-ending would keep inflating the recorded duration.
  const alreadyEnded = session.status === "ended";
  db.update(interviewSessions)
    .set(
      alreadyEnded
        ? { overallScore: overall }
        : { status: "ended", endedAt: new Date(), durationSeconds, overallScore: overall }
    )
    .where(eq(interviewSessions.id, id))
    .run();

  const transcript = db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, id))
    .orderBy(asc(interviewTurns.timestamp))
    .all()
    .map((t) => ({ speaker: t.speaker, text: t.cleanedTranscript || t.rawTranscript || "" }));

  /**
   * A report needs the candidate to have actually said something.
   *
   * The old guard only caught a completely empty transcript, so a session that
   * was ended after the opening question still went to the model - which was
   * then asked for "the candidate's strongest moments" with no candidate
   * speech in front of it. It answered by inventing the entire interview,
   * several thousand words of experience this candidate never claimed, and the
   * only reason that surfaced as an error was that the invention wasn't valid
   * JSON. Silently grading a fabricated transcript is the worse outcome.
   */
  const candidateTurns = transcript.filter(
    (t) => t.speaker === "candidate" && t.text.trim().length > 0
  );
  if (candidateTurns.length === 0) {
    return NextResponse.json({ ok: true, report: null, reason: "no_candidate_answers" });
  }

  // Ending twice (a double-click, a retry after a slow response) must not
  // insert a second report or pay for another pair of high-effort calls.
  const existingReport = db
    .select()
    .from(postInterviewReports)
    .where(eq(postInterviewReports.sessionId, id))
    .get();
  if (existingReport) {
    return NextResponse.json({ ok: true, report: existingReport, reportStatus: "ready", reused: true });
  }

  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;

  // Report generation takes ~45 seconds (a high-effort pass over the whole
  // transcript, plus the thank-you draft). Ending an interview should not hold
  // the browser open for that - the candidate has just finished talking and
  // wants the session closed. Generate in the background; the report screen
  // polls.
  db.update(interviewSessions).set({ reportError: null }).where(eq(interviewSessions.id, id)).run();

  const { started } = startJob(
    jobKeys.report(id),
    "Generating post-interview report",
    async () => {
      const report = await generatePostInterviewReport(transcript);

      // The thank-you draft is a separate, cheaper call. Attempt it on its own
      // so a rate limit there cannot throw away the report we just paid for;
      // the report screen can regenerate the email on demand.
      let thankYou: string | null = null;
      try {
        thankYou = await generateThankYouEmail({
          company: job?.company || "the company",
          role: job?.jobTitle || "the role",
          interviewerName: job?.interviewerName || undefined,
          topicsDiscussed: report.repeated_themes,
          tone: "professional",
        });
      } catch {
        thankYou = null;
      }

      db.insert(postInterviewReports)
        .values({
          sessionId: id,
          summary: report.summary,
          strongMomentsJson: report.strong_moments,
          concernsJson: report.possible_concerns,
          repeatedThemesJson: report.repeated_themes,
          employerDetailsJson: report.employer_details,
          thankYouDraft: thankYou,
        })
        .run();
    },
    (message) => {
      db.update(interviewSessions)
        .set({ reportError: message.slice(0, 500) })
        .where(eq(interviewSessions.id, id))
        .run();
    }
  );

  return NextResponse.json({ ok: true, reportStatus: "processing", started }, { status: 202 });
}
