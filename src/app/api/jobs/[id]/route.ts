import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { jobRequirements, jobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const requirements = db.select().from(jobRequirements).where(eq(jobRequirements.jobId, id)).all();
  return NextResponse.json({ job, requirements });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "status",
    "interviewStage",
    "interviewDate",
    "interviewTime",
    "interviewerName",
    "resumeId",
  ]) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();
  db.update(jobs)
    .set(allowed)
    .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.delete(jobRequirements).where(eq(jobRequirements.jobId, id)).run();
  db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
