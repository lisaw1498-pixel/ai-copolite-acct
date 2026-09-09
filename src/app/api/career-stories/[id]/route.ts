import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { careerStories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { improveStoryWording } from "@/lib/ai/generate-answer";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "improve_wording") {
    const story = db
      .select()
      .from(careerStories)
      .where(and(eq(careerStories.id, id), eq(careerStories.userId, user.id)))
      .get();
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
      const improved = await improveStoryWording(story);
      db.update(careerStories)
        .set({ ...improved, updatedAt: new Date() })
        .where(eq(careerStories.id, id))
        .run();
      return NextResponse.json({ ok: true, improved });
    } catch (err) {
      // Billing / rate-limit / auth problems are actionable - say what is wrong.
      if (err instanceof AIServiceError)
        return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
      if (err instanceof AIConfigError) return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
      return NextResponse.json({ error: "Couldn't improve wording right now." }, { status: 500 });
    }
  }

  const allowed: Record<string, unknown> = {};
  for (const key of ["title", "category", "situation", "task", "action", "result", "metrics", "employerId"]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();
  if ("metrics" in allowed) {
    allowed.verificationScore = allowed.metrics ? 100 : 80;
  }
  db.update(careerStories)
    .set(allowed)
    .where(and(eq(careerStories.id, id), eq(careerStories.userId, user.id)))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.delete(careerStories).where(and(eq(careerStories.id, id), eq(careerStories.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
