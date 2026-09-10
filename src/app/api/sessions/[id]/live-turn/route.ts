import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import {
  answerFactLinks,
  careerStories,
  interviewSessions,
  interviewTurns,
  jobs,
  liveAnswers,
  storyUsage,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAnswerStreaming } from "@/lib/ai/generate-answer";
import { getUserFacts, getUserStories, resolveResumeId } from "@/lib/facts";
import { rankFacts, rankStories } from "@/lib/retrieval";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

/**
 * Called by the Live Interview Copilot whenever the client-side question
 * detector decides a full interviewer question has arrived (or the
 * candidate used Manual Question Mode). Runs the full retrieval + Verified
 * Experience Layer pipeline and returns SAY THIS / REMEMBER THIS.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const question: string = body.question;
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;

  const questionTurn = db
    .insert(interviewTurns)
    .values({
      sessionId: id,
      speaker: "interviewer",
      rawTranscript: question,
      cleanedTranscript: question,
      questionDetected: true,
      isFollowUp: Boolean(body.isFollowUp),
    })
    .returning()
    .get();

  const jobContext = job
    ? `${job.jobTitle} at ${job.company}
${job.jobDescriptionRaw?.slice(0, 2000) ?? ""}`
    : null;

  // Retrieve only what is relevant to this question instead of shipping the
  // whole knowledge base every turn (blueprint: Latency Strategy).
  const retrievalQuery = {
    question,
    conversationContext: [body.previousQuestion, body.previousAnswer].filter(Boolean).join(" "),
    jobContext,
  };
  const allFacts = getUserFacts(user.id, {
    jobId: session.jobId,
    resumeId: resolveResumeId(user.id, job?.resumeId),
  });
  const allStories = getUserStories(user.id, session.jobId);
  const facts = rankFacts(allFacts, retrievalQuery);
  const stories = rankStories(allStories, retrievalQuery);

  const usedStoryIds = db
    .select({ careerStoryId: storyUsage.careerStoryId })
    .from(storyUsage)
    .where(eq(storyUsage.sessionId, id))
    .all()
    .map((r) => r.careerStoryId);

  const usedSet = new Set(usedStoryIds);
  const availableStories = stories.map((st) => ({
    id: st.id,
    title: st.title,
    category: st.category,
    alreadyUsed: usedSet.has(st.id),
  }));

  const started = Date.now();
  const encoder = new TextEncoder();

  /**
   * Server-Sent Events. The candidate sees SAY THIS painting token by token
   * instead of staring at a spinner for the whole generation, which is the
   * difference between usable and unusable in a live interview.
   *
   * Event order: `delta`* -> (`corrected`?) -> `final`, or `error`.
   */
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { answer: result, corrected, removed } = await generateAnswerStreaming(
          {
            question,
            previousQuestion: body.previousQuestion,
            previousAnswer: body.previousAnswer,
            facts,
            stories,
            jobContext,
            previouslyUsedStoryIds: usedStoryIds,
            responseLength: body.responseLength || "standard",
            isFollowUpHint: Boolean(body.isFollowUp),
            answerStyle: body.answerStyle,
      interviewer: job
        ? { name: job.interviewerName, role: job.interviewerRole, notes: job.interviewerNotes }
        : null,
            preferredStoryId: body.preferredStoryId ?? null,
          },
          {
            onSayThisDelta: (text) => send("delta", { text }),
            // Cue cards reach the panel as soon as they are validated, without
            // waiting for the say_this rewrite that may follow.
            onCues: (payload) => send("cues", payload),
          }
        );

        const latency = Date.now() - started;

        // If claim validation rewrote the answer, tell the client explicitly so
        // it can replace the streamed text rather than silently diverging from
        // what the candidate just read.
        if (corrected) send("corrected", { say_this: result.say_this, removed });

        const answer = db
          .insert(liveAnswers)
          .values({
            sessionId: id,
            interviewTurnId: questionTurn.id,
            question,
            questionType: result.question_type,
            answer: result.say_this,
            answerLength: body.responseLength || "standard",
            framework: result.framework,
            careerStoryId: result.story_id,
            talkingPointsJson: result.remember_this,
            verifiedEvidenceJson: result.facts_used,
            excludedClaimsJson: result.excluded_unverified_claims,
            transferableJson: result.transferable_experience,
            confidence: result.confidence,
            generationLatencyMs: latency,
          })
          .returning()
          .get();

        for (const f of result.facts_used ?? []) {
          db.insert(answerFactLinks)
            .values({
              answerId: answer.id,
              answerSource: "live",
              candidateFactId: f.fact_id || null,
              claimText: f.claim,
              verificationStatusAtGeneration: f.verification_status,
              source: f.source,
            })
            .run();
        }

        if (result.story_id) {
          db.insert(storyUsage).values({ sessionId: id, careerStoryId: result.story_id }).run();
          db.update(careerStories)
            .set({
              timesUsed: (allStories.find((st) => st.id === result.story_id)?.timesUsed ?? 0) + 1,
              lastUsedAt: new Date(),
            })
            .where(eq(careerStories.id, result.story_id))
            .run();
        }

        send("final", {
          answer,
          generated: result,
          turnId: questionTurn.id,
          availableStories,
          storyAlreadyUsed: result.story_id ? usedSet.has(result.story_id) : false,
          corrected,
          latencyMs: latency,
        });
      } catch (err) {
        // Billing / rate-limit / auth problems are actionable - say what is wrong.
        if (err instanceof AIServiceError)
          return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
        if (err instanceof AIConfigError) {
          send("error", { error: err.message, needsApiKey: true });
        } else {
          // The candidate gets a calm message, but the real cause must not
          // vanish - without this a failing live interview is undebuggable.
          console.error("[live-turn] generation failed:", err);
          send("error", {
            error: "Couldn't generate an answer right now.",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops proxies (and Next's own dev proxy) from buffering the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
