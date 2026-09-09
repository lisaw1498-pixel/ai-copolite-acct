import { callClaudeJSON, callClaudeText } from "./client";

export type PostInterviewReport = {
  summary: string;
  strong_moments: string[];
  possible_concerns: string[];
  repeated_themes: string[];
  employer_details: {
    role_expectations?: string;
    team_structure?: string;
    major_challenges?: string;
    success_metrics?: string;
    hiring_timeline?: string;
    next_steps?: string;
    technology_environment?: string;
    travel_requirements?: string;
  };
};

const REPORT_SYSTEM = `You analyze a completed interview transcript (interviewer questions and candidate answers) and produce a post-interview report. Identify the candidate's strongest response moments, any possible employer concerns implied by hesitant/weak answers or gaps, themes that came up repeatedly, and any concrete information the employer revealed about the role, team, challenges, success metrics, timeline, tech environment, or travel. Only report what is actually evidenced in the transcript - do not invent details.

Return only JSON:
{ "summary": string, "strong_moments": [string], "possible_concerns": [string], "repeated_themes": [string], "employer_details": { "role_expectations": string, "team_structure": string, "major_challenges": string, "success_metrics": string, "hiring_timeline": string, "next_steps": string, "technology_environment": string, "travel_requirements": string } }`;

export async function generatePostInterviewReport(
  transcript: { speaker: string; text: string }[]
): Promise<PostInterviewReport> {
  const text = transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n");
  return callClaudeJSON<PostInterviewReport>({
    system: REPORT_SYSTEM,
    prompt: `TRANSCRIPT:\n${text.slice(0, 16000)}`,
    maxTokens: 16000,
    effort: "high",
  });
}

export async function generateThankYouEmail(opts: {
  company: string;
  role: string;
  interviewerName?: string;
  topicsDiscussed: string[];
  tone: "professional" | "warm" | "concise";
}): Promise<string> {
  return callClaudeText({
    system:
      "You write a short, genuine post-interview thank-you email a candidate can send. Reference specific topics discussed naturally. Do not fabricate details beyond what's given. Return only the email body text, no subject line, no JSON.",
    prompt: `Company: ${opts.company}\nRole: ${opts.role}\nInterviewer: ${
      opts.interviewerName || "the interviewer"
    }\nTone: ${opts.tone}\nTopics discussed: ${opts.topicsDiscussed.join(", ") || "the role and team"}`,
    maxTokens: 4000,
    effort: "medium",
  });
}
