import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { resumes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { extractTextFromUpload } from "@/lib/parsing";
import { extractResumeFacts } from "@/lib/ai/extract";
import { applyExtractedResume, markResumeAnalyzed, markResumeFailed } from "@/lib/facts";
import { AIConfigError, AIServiceError } from "@/lib/ai/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.createdAt))
    .all();
  return NextResponse.json({ resumes: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const pastedText = form.get("text") as string | null;
  const name = (form.get("name") as string) || file?.name || "Resume";

  let rawText = "";
  try {
    if (file) rawText = await extractTextFromUpload(file);
    else if (pastedText) rawText = pastedText;
    else return NextResponse.json({ error: "No file or text provided." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Couldn't read that file. Try PDF, DOCX, or TXT." }, { status: 400 });
  }

  if (rawText.trim().length < 40) {
    return NextResponse.json({ error: "That resume looks empty or unreadable." }, { status: 400 });
  }

  const existingCount = db.select().from(resumes).where(eq(resumes.userId, user.id)).all().length;

  const resume = db
    .insert(resumes)
    .values({
      userId: user.id,
      name,
      fileName: file?.name,
      rawText,
      status: "processing",
      isDefault: existingCount === 0,
    })
    .returning()
    .get();

  try {
    const extracted = await extractResumeFacts(rawText);
    markResumeAnalyzed(resume.id, rawText, extracted);
    applyExtractedResume(user.id, resume.id, extracted, rawText);
    return NextResponse.json({ resume: { ...resume, status: "analyzed" }, extracted });
  } catch (err) {
    markResumeFailed(resume.id);
    // Billing / rate-limit / auth problems are actionable - say what is wrong.
    if (err instanceof AIServiceError)
      return NextResponse.json({ error: err.message, actionable: true }, { status: 402 });
    if (err instanceof AIConfigError) {
      return NextResponse.json(
        { error: err.message, resumeId: resume.id, needsApiKey: true },
        { status: 424 }
      );
    }
    return NextResponse.json(
      { error: "AI analysis failed. You can retry from the resume list.", resumeId: resume.id },
      { status: 500 }
    );
  }
}
