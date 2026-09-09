import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewQuestions, jobs, preparedAnswers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = db
    .select({
      answer: preparedAnswers,
      question: interviewQuestions,
      job: jobs,
    })
    .from(preparedAnswers)
    .leftJoin(interviewQuestions, eq(preparedAnswers.questionId, interviewQuestions.id))
    .leftJoin(jobs, eq(interviewQuestions.jobId, jobs.id))
    .where(eq(preparedAnswers.userId, user.id))
    .orderBy(desc(preparedAnswers.updatedAt))
    .all();

  return NextResponse.json({ items: rows });
}
