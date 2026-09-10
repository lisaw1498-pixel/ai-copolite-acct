import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, jobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { generateAnswerStreaming } from "@/lib/ai/generate-answer";
import { getUserFacts, getUserStories, resolveResumeId } from "@/lib/facts";
import { rankFacts, rankStories } from "@/lib/retrieval";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

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

  const job = session.jobId ? db.select().from(jobs).where(eq(jobs.id, session.jobId)).get() : null;
  const jobContext = job
    ? `${job.jobTitle} at ${job.company}\n${job.jobDescriptionRaw?.slice(0, 2000) ?? ""}`
    : null;

  const retrievalQuery = { question, conversationContext: body.previousQuestion ?? "", jobContext };
  const facts = rankFacts(getUserFacts(user.id, {
    jobId: session.jobId,
    resumeId: resolveResumeId(user.id, job?.resumeId),
  }), retrievalQuery);
  const stories = rankStories(getUserStories(user.id), retrievalQuery);

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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
