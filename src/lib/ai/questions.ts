import { callClaudeJSON } from "./client";
import { FactForPrompt } from "./types";

export type GeneratedQuestion = {
  question: string;
  category: string;
  likelihood: "high" | "medium" | "low";
  difficulty: "easy" | "medium" | "hard";
};

const QUESTION_SYSTEM = `You generate a realistic set of interview questions an interviewer would likely ask this candidate for this specific job, based on the job requirements and the candidate's verified fact base. Cover a spread of categories: opening, resume, behavioral, star, technical, leadership, customer_success, project_management, gap, culture, motivation, salary, availability, closing. Favor questions that probe the job's most important requirements, including at least a few that probe any true gaps (asked honestly, not as traps). Return 15-25 questions.

Return only JSON: { "questions": [ { "question": string, "category": string, "likelihood": "high"|"medium"|"low", "difficulty": "easy"|"medium"|"hard" } ] }`;

export async function generateInterviewQuestions(opts: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  requirements: { requirement: string; category: string; priority: string }[];
  facts: FactForPrompt[];
}): Promise<GeneratedQuestion[]> {
  const factsBlock = opts.facts
    .map((f) => `- (${f.factType}, ${f.verificationStatus}) ${f.factKey}: ${f.factValue}`)
    .join("\n");
  const result = await callClaudeJSON<{ questions: GeneratedQuestion[] }>({
    system: QUESTION_SYSTEM,
    prompt: `JOB: ${opts.jobTitle} at ${opts.company}\n\nJOB DESCRIPTION EXCERPT:\n${opts.jobDescription.slice(
      0,
      4000
    )}\n\nKEY REQUIREMENTS:\n${opts.requirements
      .slice(0, 30)
      .map((r) => `- (${r.priority}) ${r.requirement}`)
      .join("\n")}\n\nCANDIDATE FACTS:\n${factsBlock || "(none)"}`,
    maxTokens: 16000,
    effort: "high",
  });
  return result.questions;
}
