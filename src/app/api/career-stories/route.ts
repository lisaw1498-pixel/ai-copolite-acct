import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { careerStories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .select()
    .from(careerStories)
    .where(eq(careerStories.userId, user.id))
    .orderBy(desc(careerStories.updatedAt))
    .all();
  return NextResponse.json({ stories: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.situation) {
    return NextResponse.json({ error: "Title and situation are required." }, { status: 400 });
  }

  const hasMetrics = Boolean(body.metrics?.trim());
  const story = db
    .insert(careerStories)
    .values({
      userId: user.id,
      title: body.title,
      employerId: body.employerId || null,
      category: body.category,
      situation: body.situation,
      task: body.task,
      action: body.action,
      result: body.result,
      metrics: body.metrics,
      skillsJson: body.skills ?? [],
      technologyJson: body.technologies ?? [],
      tagsJson: body.tags ?? [],
      strengthScore: [body.situation, body.task, body.action, body.result].filter(Boolean).length * 20,
      verificationScore: hasMetrics ? 100 : 80,
    })
    .returning()
    .get();

  return NextResponse.json({ story });
}
