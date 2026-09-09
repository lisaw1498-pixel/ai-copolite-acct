import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  for (const key of [
    "fullName",
    "currentTitle",
    "targetTitle",
    "industry",
    "yearsExperience",
    "linkedinUrl",
    "onboardingCompleted",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();

  db.update(users).set(allowed).where(eq(users.id, user.id)).run();
  return NextResponse.json({ ok: true });
}
