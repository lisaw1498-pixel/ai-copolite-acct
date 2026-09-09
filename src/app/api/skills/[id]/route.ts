import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { skills, technologies } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const table = body.kind === "technology" ? technologies : skills;
  const allowed: Record<string, unknown> = {};
  for (const key of ["experienceLevel", "verificationStatus", "yearsExperience", "proficiency", "verified"]) {
    if (key in body) allowed[key] = body[key];
  }
  db.update(table)
    .set(allowed)
    .where(and(eq(table.id, id), eq(table.userId, user.id)))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind");
  const table = kind === "technology" ? technologies : skills;
  db.delete(table).where(and(eq(table.id, id), eq(table.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
