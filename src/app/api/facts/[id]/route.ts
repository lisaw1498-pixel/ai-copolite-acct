import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { candidateFacts, verificationReviews } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Actions: confirm | reject | mark_transferable | edit | merge
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const fact = db
    .select()
    .from(candidateFacts)
    .where(and(eq(candidateFacts.id, id), eq(candidateFacts.userId, user.id)))
    .get();
  if (!fact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let newStatus = fact.verificationStatus;
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  switch (body.action) {
    case "confirm":
      newStatus = "verified_user";
      updates.userConfirmed = true;
      if (body.details) {
        updates.factValue = body.details.value ?? fact.factValue;
        updates.sourceExcerpt = [fact.sourceExcerpt, body.details.note].filter(Boolean).join(" | ");
      }
      break;
    case "reject":
      newStatus = "unverified";
      updates.userConfirmed = false;
      break;
    case "mark_transferable":
      newStatus = "transferable";
      break;
    case "edit":
      if (typeof body.factValue === "string") updates.factValue = body.factValue;
      if (typeof body.normalizedValue === "string") updates.normalizedValue = body.normalizedValue;
      break;
    case "merge":
      // Merge just re-confirms this fact as the canonical one and discards a duplicate.
      newStatus = "verified_user";
      if (body.duplicateId) {
        db.delete(candidateFacts)
          .where(and(eq(candidateFacts.id, body.duplicateId), eq(candidateFacts.userId, user.id)))
          .run();
      }
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  updates.verificationStatus = newStatus;
  db.update(candidateFacts).set(updates).where(eq(candidateFacts.id, id)).run();

  db.insert(verificationReviews)
    .values({
      userId: user.id,
      candidateFactId: id,
      reviewAction: body.action,
      previousStatus: fact.verificationStatus,
      newStatus,
    })
    .run();

  return NextResponse.json({ ok: true, verificationStatus: newStatus });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.delete(candidateFacts).where(and(eq(candidateFacts.id, id), eq(candidateFacts.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
