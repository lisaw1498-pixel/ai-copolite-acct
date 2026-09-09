import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { interviewSessions, interviewTurns } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Records speech that is NOT a detected interviewer question - in practice,
 * the candidate's own answers.
 *
 * Without this the live session stored only interviewer turns, so the
 * post-interview report was asked to judge "the candidate's strongest
 * moments" from a transcript that contained nothing the candidate said. The
 * copilot's *suggested* answer lives in live_answers, but that is what the
 * candidate was advised to say, not what they actually said - the report must
 * not conflate the two.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const text: string = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const speaker: string = ["candidate", "interviewer", "unknown"].includes(body.speaker)
    ? body.speaker
    : "unknown";

  const session = db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, user.id)))
    .get();
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Don't keep recording into a session the candidate has already ended.
  if (session.status === "ended") {
    return NextResponse.json({ error: "Session already ended" }, { status: 409 });
  }

  const turn = db
    .insert(interviewTurns)
    .values({
      sessionId: id,
      speaker,
      rawTranscript: text,
      cleanedTranscript: text,
      questionDetected: false,
    })
    .returning()
    .get();

  return NextResponse.json({ turn });
}
