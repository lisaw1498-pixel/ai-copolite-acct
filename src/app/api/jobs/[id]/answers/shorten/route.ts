import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewQuestions, jobs, preparedAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { condenseAnswer } from "@/lib/ai/condense";
import { isJobRunning, startJob } from "@/lib/jobs";

const jobKey = (jobId: string) => `shorten:${jobId}`;

/** An answer needs a short version when it has none distinct from the full text. */
function needsShortening(row: { shortAnswer: string | null; standardAnswer: string | null }) {
  const full = (row.standardAnswer ?? "").trim();
  const short = (row.shortAnswer ?? "").trim();
  return full.length > 0 && (short.length === 0 || short === full);
}

function ownJob(userId: string, jobId: string) {
  return db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).get();
}

function answersForJob(userId: string, jobId: string) {
  return db
    .select({
      id: preparedAnswers.id,
      question: interviewQuestions.question,
      shortAnswer: preparedAnswers.shortAnswer,
      standardAnswer: preparedAnswers.standardAnswer,
    })
    .from(preparedAnswers)
    .innerJoin(interviewQuestions, eq(interviewQuestions.id, preparedAnswers.questionId))
    .where(and(eq(interviewQuestions.jobId, jobId), eq(preparedAnswers.userId, userId)))
    .all();
}

/** Progress, so the hub can show how many answers still need a short version. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownJob(user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = answersForJob(user.id, id);
  const pending = rows.filter(needsShortening).length;
  return NextResponse.json({
    total: rows.length,
    withShort: rows.length - pending,
    pending,
    running: isJobRunning(jobKey(id)),
  });
}

/**
 * Writes a short opening version for every answer on this job that lacks one.
 *
 * One model call per answer, so this runs in the background and the hub polls
 * GET - sixteen answers in a request handler would time out, and the candidate
 * should not be made to sit and watch it either.
 *
 * Each answer is condensed and saved on its own. One failure (a rejected
 * shortening, a rate limit) costs that answer and no others, rather than
 * throwing away work already paid for.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownJob(user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pending = answersForJob(user.id, id).filter(needsShortening);
  if (pending.length === 0) {
    return NextResponse.json({ ok: true, started: false, pending: 0 });
  }

  const { started } = startJob(
    jobKey(id),
    `Shortening ${pending.length} answers`,
    async () => {
      for (const row of pending) {
        try {
          const { short } = await condenseAnswer({
            question: row.question,
            fullAnswer: row.standardAnswer ?? "",
          });
          db.update(preparedAnswers)
            .set({ shortAnswer: short, updatedAt: new Date() })
            .where(eq(preparedAnswers.id, row.id))
            .run();
        } catch (err) {
          // Leave this one as-is. The full answer still works, and the hub
          // will show it as still needing a short version.
          console.error(`Could not shorten answer ${row.id}:`, err);
        }
      }
    },
    () => {
      // Per-answer failures are handled above; nothing global to record.
    }
  );

  return NextResponse.json({ ok: true, started, pending: pending.length }, { status: 202 });
}
