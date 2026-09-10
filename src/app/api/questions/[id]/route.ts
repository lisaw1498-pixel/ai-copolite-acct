import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { answerFactLinks, interviewQuestions, preparedAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const question = db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.id, id), eq(interviewQuestions.userId, user.id)))
    .get();
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ question });
}

/** Removes a question and the prepared answer that belonged to it. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const question = db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.id, id), eq(interviewQuestions.userId, user.id)))
    .get();
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear the answer and its evidence links first so nothing is orphaned.
  const answer = db
    .select()
    .from(preparedAnswers)
    .where(and(eq(preparedAnswers.questionId, id), eq(preparedAnswers.userId, user.id)))
    .get();
  if (answer) {
    db.delete(answerFactLinks).where(eq(answerFactLinks.answerId, answer.id)).run();
    db.delete(preparedAnswers).where(eq(preparedAnswers.id, answer.id)).run();
  }
  db.delete(interviewQuestions).where(eq(interviewQuestions.id, id)).run();
  return NextResponse.json({ ok: true });
}
