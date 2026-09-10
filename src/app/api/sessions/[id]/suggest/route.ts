import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewQuestions, interviewSessions, jobs, preparedAnswers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAnswerStreaming } from "@/lib/ai/generate-answer";
import { getUserFacts, getUserStories, resolveResumeId } from "@/lib/facts";
import { rankFacts, rankStories } from "@/lib/retrieval";
import { matchPreparedQuestion } from "@/lib/match-prepared";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

/**
 * Sends a complete answer down the same event stream the streaming path uses,
 * so the client needs no separate code path for a prepared answer.
 */
function sseOnce(payload: { delta: string; cues: unknown; final: unknown }): Response {
  const encoder = new TextEncoder();
  const frame = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(frame("delta", { text: payload.delta }));
      controller.enqueue(frame("cues", payload.cues));
      controller.enqueue(frame("final", payload.final));
      controller.close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Suggests a grounded answer to the question the mock interviewer just asked,
 * so the candidate can read it and practise saying it aloud.
 *
 * Deliberately writes nothing to the transcript. The post-interview report
 * grades what the candidate actually said; recording the coaching text as a
 * turn would let the report grade the app's own suggestion instead, which
 * would make the score meaningless.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const question: string = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  /**
   * If the candidate already wrote an answer to this question, show them that.
   *
   * They prepared and approved these for this interview - regenerating a fresh
   * answer here meant they practised against wording they had never seen, and
   * the answers they actually wrote were never surfaced at all. Their own words
   * are also verified by definition, so there is nothing to ground or check.
   */
  if (session.jobId) {
    const prepared = db
      .select({
        question: interviewQuestions.question,
        short: preparedAnswers.shortAnswer,
        standard: preparedAnswers.standardAnswer,
        long: preparedAnswers.longAnswer,
      })
      .from(interviewQuestions)
      .innerJoin(preparedAnswers, eq(preparedAnswers.questionId, interviewQuestions.id))
      .where(
        and(
          eq(interviewQuestions.jobId, session.jobId),
          eq(interviewQuestions.userId, user.id),
          eq(preparedAnswers.approved, true)
        )
      )
      .all();

    const wanted: "short" | "standard" | "long" =
      body.responseLength === "short" ? "short" : body.responseLength === "long" ? "long" : "standard";

    const usable = prepared
      .map((p) => ({
        question: p.question,
        // Fall back across lengths: an answer written only at standard length
        // is still the answer they prepared.
        text: (p[wanted] || p.standard || p.long || p.short || "").trim(),
      }))
      .filter((p) => p.text.length > 0);

    const hit = matchPreparedQuestion(question, usable.map((p) => ({ item: p, question: p.question })));
    if (hit) {
      return sseOnce({
        delta: hit.item.text,
        cues: { remember_this: [], grounding: "prepared" },
        final: {
          generated: { say_this: hit.item.text, remember_this: [] },
          corrected: false,
          source: "prepared",
          matchedQuestion: hit.item.question,
        },
      });
    }
  }

  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;
  const jobContext = job
    ? `${job.jobTitle} at ${job.company}\n${job.jobDescriptionRaw?.slice(0, 2000) ?? ""}`
    : null;

  const retrievalQuery = { question, conversationContext: body.previousQuestion ?? "", jobContext };
  const facts = rankFacts(getUserFacts(user.id, {
    jobId: session.jobId,
    resumeId: resolveResumeId(user.id, job?.resumeId),
  }), retrievalQuery);
  const stories = rankStories(getUserStories(user.id, session.jobId), retrievalQuery);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const { answer, corrected } = await generateAnswerStreaming(
          {
            question,
            facts,
            stories,
            jobContext,
            responseLength: body.responseLength || "standard",
            interviewer: job
              ? { name: job.interviewerName, role: job.interviewerRole, notes: job.interviewerNotes }
              : null,
          },
          {
            onSayThisDelta: (text) => send("delta", { text }),
            onCues: (payload) => send("cues", payload),
          }
        );
        send("final", { generated: answer, corrected });
      } catch (err) {
        if (err instanceof AIServiceError) send("error", { error: err.message, actionable: true });
        else if (err instanceof AIConfigError) send("error", { error: err.message, needsApiKey: true });
        else send("error", { error: "Couldn't suggest an answer right now." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
