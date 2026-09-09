import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { resumes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractResumeFacts } from "@/lib/ai/extract";
import { applyExtractedResume, markResumeAnalyzed, markResumeFailed } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

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
    try {
      const extracted = await extractResumeFacts(resume.rawText);
      markResumeAnalyzed(resume.id, resume.rawText, extracted);
      applyExtractedResume(user.id, resume.id, extracted);
      return NextResponse.json({ ok: true, extracted });
    } catch (err) {
      markResumeFailed(resume.id);
      // Billing / rate-limit / auth problems are actionable - say what is wrong.
      if (err instanceof AIServiceError)
        return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
      if (err instanceof AIConfigError) {
        return NextResponse.json({ error: err.message, needsApiKey: true }, { status: 424 });
      }
      return NextResponse.json({ error: "AI analysis failed." }, { status: 500 });
    }
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
