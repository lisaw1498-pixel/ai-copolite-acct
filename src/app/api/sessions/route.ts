import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .select({ session: interviewSessions, job: jobs })
    .from(interviewSessions)
    .leftJoin(jobs, eq(interviewSessions.jobId, jobs.id))
    .where(eq(interviewSessions.userId, user.id))
    .orderBy(desc(interviewSessions.startedAt))
    .all();
  return NextResponse.json({ sessions: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (!["mock", "live"].includes(body.sessionType)) {
    return NextResponse.json({ error: "sessionType must be 'mock' or 'live'" }, { status: 400 });
  }

  const session = db
    .insert(interviewSessions)
    .values({
      userId: user.id,
      jobId: body.jobId || null,
      sessionType: body.sessionType,
      configJson: body.config || {},
      status: "active",
    })
    .returning()
    .get();

  return NextResponse.json({ session });
}
