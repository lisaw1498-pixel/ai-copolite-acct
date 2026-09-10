import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewQuestions, jobRequirements, jobs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { generateInterviewQuestions } from "@/lib/ai/questions";
import { getUserFacts, resolveResumeId } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.jobId, id), eq(interviewQuestions.userId, user.id)))
    .orderBy(desc(interviewQuestions.createdAt))
    .all();
  return NextResponse.json({ questions: rows });
}

/**
 * Adds a question the candidate wrote themselves.
 *
 * Stored alongside the predicted ones but flagged `generated: false`, so the
 * library can show which questions came from the candidate's own research -
 * a recruiter who told them what to expect is better evidence than a
 * prediction.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const question: string = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Question text is required" }, { status: 400 });

  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = db
    .insert(interviewQuestions)
    .values({
      jobId: id,
      userId: user.id,
      question,
      category: body.category || "custom",
      likelihood: body.likelihood || "high",
      difficulty: body.difficulty || "medium",
      generated: false,
    })
    .returning()
    .get();
  return NextResponse.json({ question: row });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const requirements = db.select().from(jobRequirements).where(eq(jobRequirements.jobId, id)).all();
  const facts = getUserFacts(user.id, { jobId: id, resumeId: resolveResumeId(user.id, job.resumeId) });

  try {
    const generated = await generateInterviewQuestions({
      jobTitle: job.jobTitle,
      company: job.company,
      jobDescription: job.jobDescriptionRaw || "",
      requirements: requirements.map((r) => ({
        requirement: r.requirement,
        category: r.category || "",
        priority: r.priority || "",
      })),
      facts,
    });

    const inserted = generated.map((q) =>
      db
        .insert(interviewQuestions)
        .values({
          jobId: id,
          userId: user.id,
          question: q.question,
          category: q.category,
          likelihood: q.likelihood,
          difficulty: q.difficulty,
          generated: true,
        })
        .returning()
        .get()
    );

    return NextResponse.json({ questions: inserted });
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    return NextResponse.json({ error: "Couldn't generate questions right now." }, { status: 500 });
  }
}
