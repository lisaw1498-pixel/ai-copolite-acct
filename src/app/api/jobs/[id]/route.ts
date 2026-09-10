import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import {
  answerFactLinks,
  candidateFacts,
  interviewQuestions,
  interviewSessions,
  interviewTurns,
  jobRequirements,
  jobStories,
  jobs,
  liveAnswers,
  mockScores,
  postInterviewReports,
  preparedAnswers,
  storyUsage,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const requirements = db.select().from(jobRequirements).where(eq(jobRequirements.jobId, id)).all();
  return NextResponse.json({ job, requirements });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "status",
    "interviewStage",
    "interviewDate",
    "interviewTime",
    "interviewerName",
    "interviewerRole",
    "interviewerNotes",
    "resumeId",
    "companyResearch",
    "prepNotes",
    "company",
    "jobTitle",
    "location",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();
  db.update(jobs)
    .set(allowed)
    .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
    .run();
  return NextResponse.json({ ok: true });
}

/**
 * Deletes a job and everything that only exists because of it.
 *
 * Ownership is checked first and every delete is scoped to this job. The
 * previous version deleted job_requirements by job id alone, before confirming
 * the job belonged to the caller, so a guessed id wiped another account's
 * requirements.
 *
 * The cascade is manual because the schema has no foreign keys. Without it a
 * deleted job left its questions, prepared answers, sessions, transcripts and
 * reports behind with no parent - invisible in the UI, still counted in the
 * data, and still carrying interview content the candidate meant to remove.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questionIds = db
    .select({ id: interviewQuestions.id })
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.jobId, id), eq(interviewQuestions.userId, user.id)))
    .all()
    .map((r) => r.id);

  const sessionIds = db
    .select({ id: interviewSessions.id })
    .from(interviewSessions)
    .where(and(eq(interviewSessions.jobId, id), eq(interviewSessions.userId, user.id)))
    .all()
    .map((r) => r.id);

  // Answers are what answer_fact_links point at, so collect their ids before
  // the answers themselves go.
  const answerIds = [
    ...(questionIds.length
      ? db
          .select({ id: preparedAnswers.id })
          .from(preparedAnswers)
          .where(inArray(preparedAnswers.questionId, questionIds))
          .all()
          .map((r) => r.id)
      : []),
    ...(sessionIds.length
      ? db
          .select({ id: liveAnswers.id })
          .from(liveAnswers)
          .where(inArray(liveAnswers.sessionId, sessionIds))
          .all()
          .map((r) => r.id)
      : []),
  ];

  db.transaction((tx) => {
    if (answerIds.length) {
      tx.delete(answerFactLinks).where(inArray(answerFactLinks.answerId, answerIds)).run();
    }
    if (questionIds.length) {
      tx.delete(preparedAnswers).where(inArray(preparedAnswers.questionId, questionIds)).run();
      tx.delete(interviewQuestions).where(inArray(interviewQuestions.id, questionIds)).run();
    }
    if (sessionIds.length) {
      tx.delete(interviewTurns).where(inArray(interviewTurns.sessionId, sessionIds)).run();
      tx.delete(liveAnswers).where(inArray(liveAnswers.sessionId, sessionIds)).run();
      tx.delete(storyUsage).where(inArray(storyUsage.sessionId, sessionIds)).run();
      tx.delete(mockScores).where(inArray(mockScores.sessionId, sessionIds)).run();
      tx.delete(postInterviewReports).where(inArray(postInterviewReports.sessionId, sessionIds)).run();
      tx.delete(interviewSessions).where(inArray(interviewSessions.id, sessionIds)).run();
    }

    // Only the link rows. Career stories belong to the bank and are reused
    // across applications - unlinking is not deleting.
    tx.delete(jobStories).where(eq(jobStories.jobId, id)).run();

    // Facts scoped to this job (approved answers recorded as evidence). Facts
    // from the resume have no job id and are untouched.
    tx.delete(candidateFacts)
      .where(and(eq(candidateFacts.jobId, id), eq(candidateFacts.userId, user.id)))
      .run();

    tx.delete(jobRequirements).where(eq(jobRequirements.jobId, id)).run();
    tx.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).run();
  });

  return NextResponse.json({
    ok: true,
    removed: {
      questions: questionIds.length,
      sessions: sessionIds.length,
      answers: answerIds.length,
    },
  });
}
