import { db } from "@/db/client";
import {
  candidateFacts,
  candidateProfiles,
  careerStories,
  employers,
  resumes,
  skills,
  technologies,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExtractedResume } from "./ai/extract";
import { FactForPrompt, StoryForPrompt } from "./ai/types";

/**
 * Facts the copilot may use when answering for a given job.
 *
 * Resume, story and project facts have no job attached - they are the
 * candidate's experience and apply to every interview. Facts created from an
 * answer approved for a specific job stay with that job, so wording shaped for
 * one company never resurfaces as evidence at another.
 */
export function getUserFacts(userId: string, jobId?: string | null): FactForPrompt[] {
  const rows = db
    .select()
    .from(candidateFacts)
    .where(eq(candidateFacts.userId, userId))
    .all()
    .filter((r) => !r.jobId || r.jobId === jobId);
  return rows.map((r) => ({
    id: r.id,
    factType: r.factType,
    factKey: r.factKey,
    factValue: r.factValue,
    normalizedValue: r.normalizedValue,
    verificationStatus: r.verificationStatus,
    sourceType: r.sourceType,
    sourceExcerpt: r.sourceExcerpt,
  }));
}

export function getUserStories(userId: string): StoryForPrompt[] {
  const rows = db.select().from(careerStories).where(eq(careerStories.userId, userId)).all();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    situation: r.situation,
    task: r.task,
    action: r.action,
    result: r.result,
    metrics: r.metrics,
    verificationScore: r.verificationScore,
    timesUsed: r.timesUsed,
  }));
}

/** Persists everything extracted from a resume into the candidate knowledge base. */
/** Whitespace/punctuation-insensitive containment check. PDF extraction
 *  introduces line breaks and smart quotes that would otherwise defeat an
 *  exact match. */
function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * A fact may only claim "Resume Verified" if its excerpt actually appears in
 * the resume. Models sometimes assemble an excerpt from scattered fragments
 * joined by "...", which reads like a quote but cannot be located in the
 * source - that breaks View Source and quietly weakens the whole provenance
 * guarantee. Fragments are checked individually so a genuinely multi-part
 * citation still counts; anything unlocatable is downgraded to needs-review
 * rather than trusted.
 */
export function isExcerptTraceable(excerpt: string | undefined, resumeText: string): boolean {
  if (!excerpt || !excerpt.trim()) return false;
  const haystack = normalizeForMatch(resumeText);
  const parts = excerpt
    .split(/\s*\.\.\.\s*|\s*…\s*/)
    .map((p) => normalizeForMatch(p))
    .filter((p) => p.length >= 8);
  if (parts.length === 0) return false;
  return parts.every((p) => haystack.includes(p));
}

export function applyExtractedResume(
  userId: string,
  resumeId: string,
  extracted: ExtractedResume,
  resumeText = ""
) {
  // Professional summary -> candidate profile.
  const existingProfile = db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.userId, userId))
    .get();
  if (existingProfile) {
    db.update(candidateProfiles)
      .set({
        professionalSummary: extracted.professional_summary,
        profileJson: extracted,
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(candidateProfiles.userId, userId))
      .run();
  } else {
    db.insert(candidateProfiles)
      .values({
        userId,
        professionalSummary: extracted.professional_summary,
        profileJson: extracted,
        lastIndexedAt: new Date(),
      })
      .run();
  }

  // Re-analysis must not stack a second copy of everything on top of the
  // first. Facts are purely derived from this resume, so they are replaced
  // outright; the records below are de-duplicated instead of deleted, because
  // the candidate may have edited them by hand and that work must survive.
  db.delete(candidateFacts).where(eq(candidateFacts.sourceId, resumeId)).run();

  // Clear the records this same resume generated previously. Matching on names
  // is not enough - the model rephrases titles between runs ("...Ambulatory
  // Rollouts" vs "...EHR Rollouts"), so near-duplicates slip through. Rows the
  // candidate has since edited (updatedAt moved past createdAt) are left alone.
  const unedited = (row: { createdAt: Date | null; updatedAt: Date | null }) =>
    !row.updatedAt || !row.createdAt || row.updatedAt.getTime() - row.createdAt.getTime() < 1000;

  for (const row of db.select().from(careerStories).where(eq(careerStories.sourceResumeId, resumeId)).all()) {
    if (unedited(row)) db.delete(careerStories).where(eq(careerStories.id, row.id)).run();
  }
  db.delete(skills).where(eq(skills.sourceResumeId, resumeId)).run();
  db.delete(technologies).where(eq(technologies.sourceResumeId, resumeId)).run();
  db.delete(employers).where(eq(employers.sourceResumeId, resumeId)).run();

  const existing = {
    employers: new Set(
      db
        .select()
        .from(employers)
        .where(eq(employers.userId, userId))
        .all()
        .map((e) => `${e.companyName ?? ""}|${e.jobTitle ?? ""}`.toLowerCase())
    ),
    skills: new Set(
      db
        .select()
        .from(skills)
        .where(eq(skills.userId, userId))
        .all()
        .map((r) => (r.skillName ?? "").toLowerCase())
    ),
    technologies: new Set(
      db
        .select()
        .from(technologies)
        .where(eq(technologies.userId, userId))
        .all()
        .map((r) => (r.technologyName ?? "").toLowerCase())
    ),
    stories: new Set(
      db
        .select()
        .from(careerStories)
        .where(eq(careerStories.userId, userId))
        .all()
        .map((r) => (r.title ?? "").toLowerCase())
    ),
  };

  // Employers.
  const employerIdByName = new Map<string, string>();
  for (const e of extracted.employers ?? []) {
    if (existing.employers.has(`${e.company_name}|${e.job_title}`.toLowerCase())) continue;
    const row = db
      .insert(employers)
      .values({
        userId,
        sourceResumeId: resumeId,
        companyName: e.company_name,
        jobTitle: e.job_title,
        startDate: e.start_date,
        endDate: e.end_date,
        description: e.description,
      })
      .returning()
      .get();
    employerIdByName.set(e.company_name.toLowerCase(), row.id);

    // Derive employer/title/date facts directly from the parsed employment
    // history. The model only volunteered these for the most recent role,
    // which left earlier jobs invisible to the live copilot - it retrieves
    // from candidate_facts, so a job with no fact cannot be spoken about.
    const employerFacts: [string, string, string | null][] = [
      ["employer", "employer", e.company_name],
      ["job_title", "job_title", e.job_title],
      [
        "employment_dates",
        "employment_dates",
        e.start_date || e.end_date ? `${e.start_date ?? "?"} to ${e.end_date ?? "Present"}` : null,
      ],
    ];
    for (const [factType, factKey, factValue] of employerFacts) {
      if (!factValue) continue;
      db.insert(candidateFacts)
        .values({
          userId,
          factType,
          factKey: `${factKey}:${e.company_name}`,
          factValue,
          normalizedValue: factValue,
          sourceType: "resume",
          sourceId: resumeId,
          sourceDocument: "Resume",
          sourceSection: "Experience",
          sourceExcerpt: [e.company_name, e.job_title].filter(Boolean).join(" - "),
          verificationStatus: "verified_resume",
          confidenceScore: 0.99,
          userConfirmed: false,
        })
        .run();
    }
  }

  // Candidate facts (verified_resume, traceable to this resume).
  for (const f of extracted.facts ?? []) {
    // Untraceable excerpts are kept (the underlying claim is often real) but
    // flagged for review instead of being trusted in live answers.
    const traceable = resumeText ? isExcerptTraceable(f.source_excerpt, resumeText) : true;
    db.insert(candidateFacts)
      .values({
        userId,
        factType: f.fact_type,
        factKey: f.fact_key,
        factValue: f.fact_value,
        normalizedValue: f.normalized_value,
        sourceType: "resume",
        sourceId: resumeId,
        sourceDocument: "Resume",
        sourceSection: f.source_section,
        sourceExcerpt: f.source_excerpt,
        verificationStatus: traceable ? "verified_resume" : "unverified",
        confidenceScore: traceable ? f.confidence : Math.min(f.confidence ?? 0.5, 0.5),
        userConfirmed: false,
      })
      .run();
  }

  // Suggested skills.
  for (const s of extracted.suggested_skills ?? []) {
    if (existing.skills.has((s.skill_name ?? "").toLowerCase())) continue;
    db.insert(skills)
      .values({
        userId,
        sourceResumeId: resumeId,
        skillName: s.skill_name,
        category: s.category,
        yearsExperience: s.years_experience,
        proficiency: s.proficiency,
        verified: true,
        evidenceJson: { source: "resume", resumeId },
      })
      .run();
  }

  // Suggested technologies.
  for (const t of extracted.suggested_technologies ?? []) {
    if (existing.technologies.has((t.technology_name ?? "").toLowerCase())) continue;
    db.insert(technologies)
      .values({
        userId,
        sourceResumeId: resumeId,
        technologyName: t.technology_name,
        category: t.category,
        experienceLevel: t.experience_level || "working_knowledge",
        verificationStatus: "verified_resume",
        evidenceJson: { source: "resume", resumeId },
      })
      .run();
  }

  // Suggested career stories (seeded as drafts the user should review/approve).
  for (const s of extracted.suggested_career_stories ?? []) {
    if (existing.stories.has((s.title ?? "").toLowerCase())) continue;
    db.insert(careerStories)
      .values({
        userId,
        sourceResumeId: resumeId,
        title: s.title,
        category: s.category,
        situation: s.situation,
        task: s.task,
        action: s.action,
        result: s.result,
        metrics: s.metrics,
        verificationScore: s.metrics ? 80 : 60,
        strengthScore: 65,
        tagsJson: ["ai_suggested_from_resume"],
      })
      .run();
  }
}

export function markResumeAnalyzed(resumeId: string, rawText: string, parsed: ExtractedResume) {
  db.update(resumes)
    .set({ rawText, parsedJson: parsed, status: "analyzed", statusMessage: null, updatedAt: new Date() })
    .where(eq(resumes.id, resumeId))
    .run();
}

export function markResumeFailed(resumeId: string, message?: string) {
  db.update(resumes)
    .set({
      status: "failed",
      // Record why. A background job has no response to attach an error to, so
      // without this the UI can only say "something went wrong".
      statusMessage: message?.slice(0, 500) ?? null,
      updatedAt: new Date(),
    })
    .where(eq(resumes.id, resumeId))
    .run();
}
