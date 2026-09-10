import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { answerFactLinks, candidateFacts, interviewQuestions, jobs, preparedAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAnswer } from "@/lib/ai/generate-answer";
import { getUserFacts, getUserStories, resolveResumeId } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

/**
 * Returns the stored answer for this question, if one exists.
 *
 * Without this the prep screen had no way to read what it had already
 * produced, so it regenerated on every visit - three model calls per page
 * view, and it silently overwrote answers the candidate had already reviewed
 * and approved.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const row = db
    .select()
    .from(preparedAnswers)
    .where(and(eq(preparedAnswers.questionId, id), eq(preparedAnswers.userId, user.id)))
    .get();
  if (!row) return NextResponse.json({ answer: null });

  // starAnswerJson holds the full generated object for the standard length;
  // the other two lengths reuse its cues and evidence with their own prose.
  const base = (row.starAnswerJson ?? {}) as Record<string, unknown>;
  const shape = (sayThis: string | null) => ({
    ...base,
    say_this: sayThis ?? "",
    remember_this: row.talkingPointsJson ?? [],
    facts_used: row.factsUsedJson ?? [],
    excluded_unverified_claims: row.excludedClaimsJson ?? [],
  });

  return NextResponse.json({
    answer: {
      answerId: row.id,
      approved: Boolean(row.approved),
      // Lets the UI distinguish an answer the candidate wrote from one the
      // system generated - the former is stronger evidence.
      source: row.source ?? "ai",
      quick: shape(row.shortAnswer),
      standard: shape(row.standardAnswer),
      detailed: shape(row.longAnswer),
    },
  });
}

/**
 * Saves an answer the candidate wrote themselves.
 *
 * A candidate's own words are the strongest possible grounding - stronger than
 * anything generated - so this is stored as the prepared answer and marked
 * approved and user-authored straight away.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = (body.answer ?? "").trim();
  if (!text) return NextResponse.json({ error: "Answer text is required" }, { status: 400 });

  const question = db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.id, id), eq(interviewQuestions.userId, user.id)))
    .get();
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const existing = db
    .select()
    .from(preparedAnswers)
    .where(and(eq(preparedAnswers.questionId, id), eq(preparedAnswers.userId, user.id)))
    .get();

  const values = {
    standardAnswer: text,
    shortAnswer: text,
    longAnswer: text,
    source: "user",
    approved: true,
    updatedAt: new Date(),
  };

  if (existing) {
    db.update(preparedAnswers).set(values).where(eq(preparedAnswers.id, existing.id)).run();
    return NextResponse.json({ ok: true, answerId: existing.id });
  }
  const row = db
    .insert(preparedAnswers)
    .values({ questionId: id, userId: user.id, ...values })
    .returning()
    .get();
  return NextResponse.json({ ok: true, answerId: row.id });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const question = db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.id, id), eq(interviewQuestions.userId, user.id)))
    .get();
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const job = question.jobId ? db.select().from(jobs).where(eq(jobs.id, question.jobId)).get() : null;
  const facts = getUserFacts(user.id, {
    jobId: question.jobId,
    resumeId: resolveResumeId(user.id, job?.resumeId),
  });
  const stories = getUserStories(user.id, question.jobId);

  try {
    const lengths: ("quick" | "standard" | "detailed")[] = ["quick", "standard", "detailed"];
    const results = await Promise.all(
      lengths.map((len) =>
        generateAnswer({
          question: question.question,
          facts,
          stories,
          jobContext: job ? `${job.jobTitle} at ${job.company}\n${job.jobDescriptionRaw?.slice(0, 2000) ?? ""}` : null,
          responseLength: body.responseLength === "regenerate" ? len : len,
        })
      )
    );
    const [quick, standard, detailed] = results;

    const existing = db
      .select()
      .from(preparedAnswers)
      .where(and(eq(preparedAnswers.questionId, id), eq(preparedAnswers.userId, user.id)))
      .get();

    const values = {
      shortAnswer: quick.say_this,
      standardAnswer: standard.say_this,
      longAnswer: detailed.say_this,
      starAnswerJson: standard,
      talkingPointsJson: standard.remember_this,
      careerStoryId: standard.story_id,
      factsUsedJson: standard.facts_used,
      excludedClaimsJson: standard.excluded_unverified_claims,
      updatedAt: new Date(),
    };

    let answerId: string;
    if (existing) {
      // The approval belonged to the previous wording. Clear it, and drop the
      // verified_approved fact it produced - leaving that behind would let the
      // copilot quote text the candidate never actually signed off on.
      db.update(preparedAnswers)
        .set({ ...values, approved: false })
        .where(eq(preparedAnswers.id, existing.id))
        .run();
      answerId = existing.id;
      db.delete(answerFactLinks).where(eq(answerFactLinks.answerId, answerId)).run();
      db.delete(candidateFacts)
        .where(
          and(eq(candidateFacts.sourceType, "approved_answer"), eq(candidateFacts.sourceId, answerId))
        )
        .run();
    } else {
      const row = db
        .insert(preparedAnswers)
        .values({ questionId: id, userId: user.id, ...values })
        .returning()
        .get();
      answerId = row.id;
    }

    for (const f of standard.facts_used) {
      db.insert(answerFactLinks)
        .values({
          answerId,
          answerSource: "prepared",
          candidateFactId: f.fact_id || null,
          claimText: f.claim,
          verificationStatusAtGeneration: f.verification_status,
          source: f.source,
        })
        .run();
    }

    return NextResponse.json({ answerId, quick, standard, detailed });
  } catch (err) {
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
    return NextResponse.json({ error: "Couldn't generate an answer right now." }, { status: 500 });
  }
}
