import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import {
  interviewSessions,
  interviewTurns,
  jobs,
  liveAnswers,
  mockScores,
  postInterviewReports,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
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
  const reportStatus = report
    ? "ready"
    : generating
    ? "processing"
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.delete(interviewTurns).where(eq(interviewTurns.sessionId, id)).run();
  db.delete(liveAnswers).where(eq(liveAnswers.sessionId, id)).run();
  db.delete(mockScores).where(eq(mockScores.sessionId, id)).run();
  db.delete(postInterviewReports).where(eq(postInterviewReports.sessionId, id)).run();
  db.delete(interviewSessions).where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
