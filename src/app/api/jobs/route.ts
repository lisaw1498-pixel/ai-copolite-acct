import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { jobRequirements, jobs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { extractJobRequirements, matchJobToFacts } from "@/lib/ai/extract";
import { getUserFacts } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.createdAt)).all();
  return NextResponse.json({ jobs: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  const jobDescriptionRaw: string = body.jobDescriptionRaw || "";
  if (!jobDescriptionRaw.trim() && !body.company) {
    return NextResponse.json({ error: "Paste a job description or fill in the details." }, { status: 400 });
  }

  let extracted;
  try {
    extracted = jobDescriptionRaw.trim()
      ? await extractJobRequirements(jobDescriptionRaw)
      : { requirements: [], keywords: [] };
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) {
      return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    }
    return NextResponse.json({ error: "Couldn't analyze that job description." }, { status: 500 });
  }

  const job = db
    .insert(jobs)
    .values({
      userId: user.id,
      company: body.company || extracted.company_inferred || "Unknown Company",
      jobTitle: body.jobTitle || extracted.title_inferred || "Unknown Role",
      location: body.location || extracted.location_inferred,
      workType: body.workType,
      salaryRange: body.salaryRange,
      jobDescriptionRaw,
      jobDescriptionParsed: extracted,
      status: body.status || "interested",
      interviewStage: body.interviewStage,
      interviewDate: body.interviewDate,
      interviewTime: body.interviewTime,
      interviewerName: body.interviewerName,
      resumeId: body.resumeId,
    })
    .returning()
    .get();

  for (const r of extracted.requirements ?? []) {
    db.insert(jobRequirements)
      .values({
        jobId: job.id,
        requirement: r.requirement,
        category: r.category,
        priority: r.priority,
        requiredOrPreferred: r.priority,
      })
      .run();
  }

  // Run the job-specific Verified Experience Check immediately so the job
  // card can show a match score right away.
  if ((extracted.requirements ?? []).length > 0) {
    try {
      const facts = getUserFacts(user.id);
      const match = await matchJobToFacts(extracted.requirements, facts);
      db.update(jobs)
        .set({ matchScore: Math.round(match.overall_match), matchBreakdownJson: match })
        .where(eq(jobs.id, job.id))
        .run();

      for (const rm of match.requirement_matches) {
        db.update(jobRequirements)
          .set({
            candidateMatch: rm.match_status,
            candidateEvidence: rm.candidate_evidence,
            gapType: rm.match_status === "true_gap" ? "true_gap" : null,
          })
          .where(and(eq(jobRequirements.jobId, job.id), eq(jobRequirements.requirement, rm.requirement)))
          .run();
      }
    } catch {
      // Non-fatal: the job is still created, just without a match score yet.
    }
  }

  return NextResponse.json({ job });
}
