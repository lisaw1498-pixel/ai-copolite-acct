import { callClaudeJSON } from "./client";
import { FactForPrompt } from "./types";

export type ExtractedResume = {
  professional_summary: string;
  employers: {
    company_name: string;
    job_title: string;
    start_date?: string;
    end_date?: string;
    description?: string;
  }[];
  facts: {
    fact_type: string;
    fact_key: string;
    fact_value: string;
    normalized_value?: string;
    source_section?: string;
    source_excerpt: string;
    confidence: number;
  }[];
  suggested_skills: { skill_name: string; category?: string; years_experience?: number; proficiency?: string }[];
  suggested_technologies: {
    technology_name: string;
    category?: string;
    experience_level?: string;
  }[];
  suggested_career_stories: {
    title: string;
    category?: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    metrics?: string;
  }[];
};

const RESUME_EXTRACTION_SYSTEM = `You extract a structured, strictly evidence-based professional knowledge base from a candidate's resume text for the AI Interview Copilot's Verified Experience Layer.

Rules:
- Extract ONLY what is explicitly stated or unambiguously implied in the resume text. Never invent employers, dates, titles, metrics, or technologies not present in the text.
- Every fact must include a source_excerpt that is a SINGLE CONTIGUOUS VERBATIM span copied character-for-character from the resume text. Do not join separate parts of the resume with "..." or any other separator, do not paraphrase, and do not merge bullet points. If a fact is supported by several scattered lines, pick the ONE line that best supports it and use only that. An excerpt that cannot be found literally in the resume causes the fact to be rejected.
- fact_type must be one of: employer, job_title, employment_dates, years_experience, industry_experience, project, responsibility, accomplishment, metric, team_size, budget, technology, software, crm, ehr, certification, education, leadership, client_experience, implementation_experience, methodology, process_improvement, revenue_impact, customer_satisfaction, training, go_live_experience, regulatory_knowledge, technical_skill, soft_skill.
- confidence is 0.0-1.0 reflecting how directly the text supports the fact (explicit statement = high, implied = lower).
- suggested_career_stories should only be proposed when the resume text describes something with enough of a situation/action/result shape to seed a STAR story - keep them grounded strictly in resume wording, and it's fine to return an empty array.

Return only a single JSON object matching this shape, nothing else:
{
  "professional_summary": string,
  "employers": [ { "company_name": string, "job_title": string, "start_date": string, "end_date": string, "description": string } ],
  "facts": [ { "fact_type": string, "fact_key": string, "fact_value": string, "normalized_value": string, "source_section": string, "source_excerpt": string, "confidence": number } ],
  "suggested_skills": [ { "skill_name": string, "category": string, "years_experience": number, "proficiency": string } ],
  "suggested_technologies": [ { "technology_name": string, "category": string, "experience_level": string } ],
  "suggested_career_stories": [ { "title": string, "category": string, "situation": string, "task": string, "action": string, "result": string, "metrics": string } ]
}`;

/**
 * The largest output of any call in the app, and the one that overflowed.
 *
 * A dense resume becomes every employer, every skill, every technology and a
 * set of STAR stories, all as structured JSON. A 16000-token ceiling truncated
 * that mid-object on a long CV, and because the result is parsed as JSON there
 * was nothing partial to keep - the upload simply failed. Left to the default
 * ceiling, which has the headroom this needs.
 */
export async function extractResumeFacts(rawText: string): Promise<ExtractedResume> {
  return callClaudeJSON<ExtractedResume>({
    system: RESUME_EXTRACTION_SYSTEM,
    prompt: `RESUME TEXT:\n"""\n${rawText.slice(0, 18000)}\n"""`,
    effort: "medium",
  });
}

export type ExtractedJob = {
  company_inferred?: string;
  title_inferred?: string;
  location_inferred?: string;
  requirements: { requirement: string; category: string; priority: "required" | "preferred" }[];
  keywords: string[];
};

const JOB_EXTRACTION_SYSTEM = `You extract structured hiring requirements from a job description for a job-matching system. Identify each distinct requirement (skill, technology, years of experience, certification, responsibility, soft skill, industry knowledge, leadership expectation, etc.), its category, and whether it is required or merely preferred, based only on the text given. Also extract a flat list of standout keywords (technologies, methodologies, platforms, certifications) an ATS might scan for.

Return only JSON:
{
  "company_inferred": string,
  "title_inferred": string,
  "location_inferred": string,
  "requirements": [ { "requirement": string, "category": string, "priority": "required" | "preferred" } ],
  "keywords": [ string ]
}`;

export async function extractJobRequirements(jobText: string): Promise<ExtractedJob> {
  return callClaudeJSON<ExtractedJob>({
    system: JOB_EXTRACTION_SYSTEM,
    prompt: `JOB DESCRIPTION:\n"""\n${jobText.slice(0, 14000)}\n"""`,
    maxTokens: 8000,
    effort: "medium",
  });
}

export type MatchResult = {
  overall_match: number;
  score_breakdown: {
    experience: number;
    technical: number;
    leadership: number;
    industry: number;
    project_management: number;
  };
  requirement_matches: {
    requirement: string;
    category: string;
    priority: string;
    match_status: "verified" | "transferable" | "unverified" | "true_gap";
    candidate_evidence: string;
    matched_fact_ids: string[];
    recommended_positioning?: string;
  }[];
};

const MATCH_SYSTEM = `You compare a job's requirements against a candidate's VERIFIED fact base for the AI Interview Copilot's Job-Specific Verified Experience Check.

For every requirement, classify match_status strictly:
- "verified": the candidate has a fact with verification_status starting "verified_" that directly supports this exact requirement.
- "transferable": no exact match, but a verified/transferable fact shows clearly comparable experience (e.g. a different but similar EHR/CRM platform, an adjacent technology or methodology). Never call this "verified".
- "unverified": there is a hint of a connection but the supporting fact is itself unverified or too weak - requires the candidate's confirmation.
- "true_gap": no supporting evidence exists at all.

Never upgrade transferable to verified. Never invent candidate_evidence that isn't grounded in a provided fact - if match_status is true_gap, candidate_evidence should be empty.

score_breakdown values are 0-100 holistic estimates based on how well the verified+transferable facts cover that dimension of the job.

Return only JSON matching:
{
  "overall_match": number,
  "score_breakdown": { "experience": number, "technical": number, "leadership": number, "industry": number, "project_management": number },
  "requirement_matches": [ { "requirement": string, "category": string, "priority": string, "match_status": "verified"|"transferable"|"unverified"|"true_gap", "candidate_evidence": string, "matched_fact_ids": [string], "recommended_positioning": string } ]
}`;

export async function matchJobToFacts(
  requirements: { requirement: string; category: string; priority: string }[],
  facts: FactForPrompt[]
): Promise<MatchResult> {
  const factsBlock = facts
    .map((f) => `- [${f.id}] (${f.factType}, ${f.verificationStatus}) ${f.factKey}: ${f.factValue}`)
    .join("\n");
  return callClaudeJSON<MatchResult>({
    system: MATCH_SYSTEM,
    prompt: `JOB REQUIREMENTS:\n${requirements
      .map((r) => `- (${r.priority}, ${r.category}) ${r.requirement}`)
      .join("\n")}\n\nCANDIDATE FACTS:\n${factsBlock || "(none)"}`,
    effort: "medium",
  });
}
