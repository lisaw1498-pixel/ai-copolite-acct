import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { resumes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractResumeFacts } from "@/lib/ai/extract";
import { applyExtractedResume, markResumeAnalyzed, markResumeFailed } from "@/lib/facts";
import { isStale, jobKeys, startJob } from "@/lib/jobs";

/**
 * Status endpoint the upload screen polls while ingestion runs in the
 * background. Reports "stale" when a row is still marked processing but no job
 * is actually running - i.e. the server restarted mid-analysis - so the UI can
 * offer a retry instead of spinning forever.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const resume = db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .get();
  if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const stale = isStale(jobKeys.resume(id), resume.status);
  return NextResponse.json({
    resume: {
      id: resume.id,
      name: resume.name,
      fileName: resume.fileName,
      status: stale ? "failed" : resume.status,
      statusMessage: stale
        ? "Analysis stopped unexpectedly (the server restarted). Try analyzing again."
        : resume.statusMessage,
      isDefault: resume.isDefault,
      parsed: resume.status === "analyzed" ? resume.parsedJson : null,
    },
    done: stale || resume.status === "analyzed" || resume.status === "failed",
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.delete(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "set_default") {
    db.update(resumes).set({ isDefault: false }).where(eq(resumes.userId, user.id)).run();
    db.update(resumes)
      .set({ isDefault: true })
      .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
      .run();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reanalyze") {
    const resume = db.select().from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).get();
    if (!resume || !resume.rawText) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

    db.update(resumes)
      .set({ status: "processing", statusMessage: null, updatedAt: new Date() })
      .where(eq(resumes.id, id))
      .run();

    const rawText = resume.rawText;
    const { started } = startJob(
      jobKeys.resume(id),
      `Re-analyzing ${resume.name}`,
      async () => {
        const extracted = await extractResumeFacts(rawText);
        markResumeAnalyzed(id, rawText, extracted);
        applyExtractedResume(user.id, id, extracted, rawText);
      },
      (message) => markResumeFailed(id, message)
    );

    // Already running: report that rather than queueing a duplicate.
    return NextResponse.json({ ok: true, started, status: "processing" }, { status: 202 });
  }

  if (typeof body.name === "string") {
    db.update(resumes)
      .set({ name: body.name, updatedAt: new Date() })
      .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
      .run();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
