import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import {
  answerFactLinks,
  interviewSessions,
  interviewTurns,
  jobs,
  liveAnswers,
  mockScores,
  postInterviewReports,
  storyUsage,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { isJobRunning, jobKeys } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;
  const turns = db
    .select()
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, id))
    .orderBy(asc(interviewTurns.timestamp))
    .all();
  const answers = db.select().from(liveAnswers).where(eq(liveAnswers.sessionId, id)).all();
  const scores = db.select().from(mockScores).where(eq(mockScores.sessionId, id)).all();
  const report = db.select().from(postInterviewReports).where(eq(postInterviewReports.sessionId, id)).get();

  // Report generation runs in the background, so the report screen needs to
  // know whether to keep polling. "failed" covers a genuine error and the
  // crash case: a session ended with no report and no live job behind it means
  // the process died mid-generation.
  const generating = isJobRunning(jobKeys.report(id));

  // No answers means there is nothing to report on, and retrying cannot change
  // that - so this is its own state rather than a failure with a retry button.
  const answered = turns.some(
    (t) => t.speaker === "candidate" && (t.cleanedTranscript || t.rawTranscript || "").trim()
  );

  const reportStatus = report
    ? "ready"
    : generating
    ? "processing"
    : session.status === "ended" && !answered
    ? "not_enough"
    : session.reportError
    ? "failed"
    : session.status === "ended" && turns.length > 0
    ? "failed"
    : "none";

  const reportError =
    reportStatus === "failed"
      ? session.reportError ??
        "Report generation stopped unexpectedly (the server restarted). Try again from this page."
      : null;

  return NextResponse.json({
    session,
    job,
    turns,
    answers,
    scores,
    report,
    reportStatus,
    reportError,
  });
}

/**
 * Deletes a session and its transcript, answers, scores and report.
 *
 * Ownership is checked before anything is removed. The children were
 * previously deleted by session id alone, ahead of the only query that
 * checked whose session it was, so a guessed id wiped another account's
 * interview transcript while leaving their session row in place.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const answerIds = db
    .select({ id: liveAnswers.id })
    .from(liveAnswers)
    .where(eq(liveAnswers.sessionId, id))
    .all()
    .map((r) => r.id);

  db.transaction((tx) => {
    if (answerIds.length) {
      tx.delete(answerFactLinks).where(inArray(answerFactLinks.answerId, answerIds)).run();
    }
    tx.delete(interviewTurns).where(eq(interviewTurns.sessionId, id)).run();
    tx.delete(liveAnswers).where(eq(liveAnswers.sessionId, id)).run();
    tx.delete(storyUsage).where(eq(storyUsage.sessionId, id)).run();
    tx.delete(mockScores).where(eq(mockScores.sessionId, id)).run();
    tx.delete(postInterviewReports).where(eq(postInterviewReports.sessionId, id)).run();
    tx.delete(interviewSessions).where(eq(interviewSessions.id, id)).run();
  });

  return NextResponse.json({ ok: true });
}
