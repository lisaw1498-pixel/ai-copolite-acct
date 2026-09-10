import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { resumes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { extractTextFromUpload } from "@/lib/parsing";
import { extractResumeFacts } from "@/lib/ai/extract";
import { applyExtractedResume, markResumeAnalyzed, markResumeFailed } from "@/lib/facts";
import { isStale, jobKeys, startJob } from "@/lib/jobs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.createdAt))
    .all();

  // Same staleness check the single-resume endpoint does. A row still marked
  // "processing" with no live job behind it means the server restarted
  // mid-analysis; without this the list spins on it forever and the only
  // apparent fix is to delete and re-upload.
  return NextResponse.json({
    resumes: rows.map((r) => {
      const stale = isStale(jobKeys.resume(r.id), r.status);
      return {
        ...r,
        status: stale ? "failed" : r.status,
        statusMessage: stale
          ? "Analysis stopped unexpectedly (the server restarted). Try analyzing again."
          : r.statusMessage,
      };
    }),
  });
}

/**
 * Accepts the upload and returns straight away with a resume id.
 *
 * Text extraction and the structured-extraction call together take roughly two
 * minutes, which no sensible request timeout will tolerate, so both run in the
 * background. The client polls GET /api/resumes/[id] for status.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const pastedText = form.get("text") as string | null;
  const name = (form.get("name") as string) || file?.name || "Resume";

  if (!file && !pastedText?.trim()) {
    return NextResponse.json({ error: "No file or text provided." }, { status: 400 });
  }

  // Read the upload into memory now - the request body is gone once we return.
  // Parsing it is deferred; only the (fast) read happens here.
  let bytes: ArrayBuffer | null = null;
  if (file) {
    bytes = await file.arrayBuffer();
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
  }

  const existingCount = db.select().from(resumes).where(eq(resumes.userId, user.id)).all().length;

  const resume = db
    .insert(resumes)
    .values({
      userId: user.id,
      name,
      fileName: file?.name,
      rawText: pastedText?.trim() || null,
      status: "processing",
      isDefault: existingCount === 0,
    })
    .returning()
    .get();

  const fileName = file?.name ?? "resume.txt";
  const fileType = file?.type ?? "text/plain";

  startJob(
    jobKeys.resume(resume.id),
    `Analyzing ${name}`,
    async () => {
      let rawText = pastedText?.trim() ?? "";
      if (bytes) {
        rawText = await extractTextFromUpload(new File([bytes], fileName, { type: fileType }));
      }
      if (rawText.trim().length < 40) {
        throw new Error("That resume looks empty or unreadable. Try a different file, or paste the text.");
      }
      const extracted = await extractResumeFacts(rawText);
      markResumeAnalyzed(resume.id, rawText, extracted);
      applyExtractedResume(user.id, resume.id, extracted, rawText);
    },
    (message) => markResumeFailed(resume.id, message)
  );

  // 202: accepted, still working.
  return NextResponse.json({ resume: { ...resume, status: "processing" } }, { status: 202 });
}
