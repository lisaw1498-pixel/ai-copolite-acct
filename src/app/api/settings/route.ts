import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { aiConfigured } from "@/lib/ai/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = db.select().from(userSettings).where(eq(userSettings.userId, user.id)).get();
  return NextResponse.json({ settings, aiConfigured: aiConfigured() });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of ["theme", "defaultAnswerLength", "fontSize", "quickGlanceEnabled", "saveTranscripts", "saveAudio", "autoDeleteAfter"]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();
  db.update(userSettings).set(allowed).where(eq(userSettings.userId, user.id)).run();
  return NextResponse.json({ ok: true });
}
