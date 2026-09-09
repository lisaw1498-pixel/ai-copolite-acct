import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { candidateFacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .select()
    .from(candidateFacts)
    .where(eq(candidateFacts.userId, user.id))
    .orderBy(desc(candidateFacts.updatedAt))
    .all();
  return NextResponse.json({ facts: rows });
}

export async function POST(req: Request) {
  // Manual "Add Evidence" / user-entered fact.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.factType || !body.factKey || !body.factValue) {
    return NextResponse.json({ error: "factType, factKey, and factValue are required." }, { status: 400 });
  }
  const row = db
    .insert(candidateFacts)
    .values({
      userId: user.id,
      factType: body.factType,
      factKey: body.factKey,
      factValue: body.factValue,
      normalizedValue: body.normalizedValue,
      sourceType: "user_confirmed",
      sourceDocument: "Manually added",
      sourceExcerpt: body.note,
      verificationStatus: "verified_user",
      confidenceScore: 1,
      userConfirmed: true,
    })
    .returning()
    .get();
  return NextResponse.json({ fact: row });
}
