import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, jobs, postInterviewReports } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateThankYouEmail } from "@/lib/ai/post-interview";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const tone = (body.tone || "professional") as "professional" | "warm" | "concise";

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;
  const report = db.select().from(postInterviewReports).where(eq(postInterviewReports.sessionId, id)).get();

  try {
    const email = await generateThankYouEmail({
      company: job?.company || "the company",
      role: job?.jobTitle || "the role",
      interviewerName: job?.interviewerName || undefined,
      topicsDiscussed: (report?.repeatedThemesJson as string[]) || [],
      tone,
    });
    if (report) {
      db.update(postInterviewReports).set({ thankYouDraft: email }).where(eq(postInterviewReports.id, report.id)).run();
    }
    return NextResponse.json({ email });
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    return NextResponse.json({ error: "Couldn't generate the email right now." }, { status: 500 });
  }
}
