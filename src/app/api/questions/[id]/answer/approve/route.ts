import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { candidateFacts, preparedAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const answer = db
    .select()
    .from(preparedAnswers)
    .where(and(eq(preparedAnswers.questionId, id), eq(preparedAnswers.userId, user.id)))
    .get();
  if (!answer) return NextResponse.json({ error: "No answer to approve yet" }, { status: 404 });

  db.update(preparedAnswers).set({ approved: true, updatedAt: new Date() }).where(eq(preparedAnswers.id, answer.id)).run();

  // Approved answers themselves become a source of verified experience for
  // future generations (VERIFIED — APPROVED ANSWER).
  db.insert(candidateFacts)
    .values({
      userId: user.id,
      factType: "accomplishment",
      factKey: "approved_answer",
      factValue: answer.standardAnswer || answer.shortAnswer || "",
      sourceType: "approved_answer",
      sourceId: answer.id,
      sourceDocument: "Approved Interview Answer",
      verificationStatus: "verified_approved",
      confidenceScore: 1,
      userConfirmed: true,
    })
    .run();

  return NextResponse.json({ ok: true });
}
