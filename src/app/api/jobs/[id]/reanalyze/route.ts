import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { jobRequirements, jobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { matchJobToFacts } from "@/lib/ai/extract";
import { getUserFacts } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).get();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const requirements = db.select().from(jobRequirements).where(eq(jobRequirements.jobId, id)).all();
  if (requirements.length === 0) {
    return NextResponse.json({ error: "This job has no extracted requirements to match against." }, { status: 400 });
  }

  try {
    const facts = getUserFacts(user.id);
    const match = await matchJobToFacts(
      requirements.map((r) => ({ requirement: r.requirement, category: r.category || "", priority: r.priority || "" })),
      facts
    );
    db.update(jobs)
      .set({ matchScore: Math.round(match.overall_match), matchBreakdownJson: match, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .run();

    for (const rm of match.requirement_matches) {
      db.update(jobRequirements)
        .set({
          candidateMatch: rm.match_status,
          candidateEvidence: rm.candidate_evidence,
          gapType: rm.match_status === "true_gap" ? "true_gap" : null,
        })
        .where(and(eq(jobRequirements.jobId, id), eq(jobRequirements.requirement, rm.requirement)))
        .run();
    }
    return NextResponse.json({ ok: true, match });
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) {
      return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    }
    return NextResponse.json({ error: "Re-analysis failed." }, { status: 500 });
  }
}
