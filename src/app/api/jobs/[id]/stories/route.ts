import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { careerStories, jobStories, jobs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

/** Confirms the job belongs to the signed-in user. */
function ownJob(userId: string, jobId: string) {
  return db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).get();
}

/**
 * The stories chosen for this interview, plus everything else in the bank so
 * the hub can offer them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownJob(user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const linkedIds = new Set(
    db.select().from(jobStories).where(eq(jobStories.jobId, id)).all().map((r) => r.careerStoryId)
  );
  const all = db
    .select()
    .from(careerStories)
    .where(eq(careerStories.userId, user.id))
    .orderBy(desc(careerStories.createdAt))
    .all()
    .map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      situation: s.situation,
      result: s.result,
      metrics: s.metrics,
      timesUsed: s.timesUsed,
      linked: linkedIds.has(s.id),
    }));

  return NextResponse.json({ stories: all, linkedCount: linkedIds.size });
}

/** Links an existing story to this interview, or creates one and links it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownJob(user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  let storyId: string | null = body.careerStoryId ?? null;

  if (!storyId) {
    const title: string = (body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
    const row = db
      .insert(careerStories)
      .values({
        userId: user.id,
        title,
        category: body.category || "custom",
        situation: body.situation || null,
        task: body.task || null,
        action: body.action || null,
        result: body.result || null,
        metrics: body.metrics || null,
        // Written by the candidate, so it is verified by definition - this is
        // their own account of their own work.
        verificationScore: 100,
        strengthScore: 75,
      })
      .returning()
      .get();
    storyId = row.id;
  } else {
    const owned = db
      .select()
      .from(careerStories)
      .where(and(eq(careerStories.id, storyId), eq(careerStories.userId, user.id)))
      .get();
    if (!owned) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const existing = db
    .select()
    .from(jobStories)
    .where(and(eq(jobStories.jobId, id), eq(jobStories.careerStoryId, storyId)))
    .get();
  if (!existing) {
    db.insert(jobStories).values({ jobId: id, careerStoryId: storyId }).run();
  }
  return NextResponse.json({ ok: true, careerStoryId: storyId });
}

/**
 * Unlinks a story from this interview. The story itself is left alone - it
 * belongs to the story bank and is likely used by other applications.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownJob(user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storyId = new URL(req.url).searchParams.get("careerStoryId");
  if (!storyId) return NextResponse.json({ error: "careerStoryId is required" }, { status: 400 });

  db.delete(jobStories)
    .where(and(eq(jobStories.jobId, id), eq(jobStories.careerStoryId, storyId)))
    .run();
  return NextResponse.json({ ok: true });
}
