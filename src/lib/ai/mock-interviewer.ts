import { callClaudeJSON } from "./client";

export type MockInterviewerTurn = {
  message: string;
  is_follow_up: boolean;
  question_category: string;
  should_end: boolean;
};

const INTERVIEWER_SYSTEM_BASE = (difficulty: string, interviewType: string) => `You are role-playing as a professional job interviewer conducting a ${interviewType} mock interview, at a "${difficulty}" difficulty/tone. Ask one question at a time, listen to (read) the candidate's answer, and then either ask an intelligent, natural follow-up that probes deeper into what they just said, or move to a new relevant question. Keep your own turns short (1-3 sentences) like a real interviewer. Do not critique the candidate's answers inline unless explicitly asked to. After a reasonable number of exchanges (interviewer's judgment, typically 6-12 questions), set should_end to true with a closing remark.

Return only JSON: { "message": string, "is_follow_up": boolean, "question_category": string, "should_end": boolean }`;

export async function nextMockInterviewerTurn(opts: {
  difficulty: string;
  interviewType: string;
  jobTitle?: string;
  company?: string;
  transcript: { speaker: string; text: string }[];
}): Promise<MockInterviewerTurn> {
  const history = opts.transcript
    .map((t) => `${t.speaker === "ai_interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`)
    .join("\n");
  return callClaudeJSON<MockInterviewerTurn>({
    system: INTERVIEWER_SYSTEM_BASE(opts.difficulty, opts.interviewType),
    prompt: `Role: ${opts.jobTitle ?? "the target role"} at ${opts.company ?? "the company"}.\n\nCONVERSATION SO FAR:\n${
      history || "(interview just starting - ask your opening question)"
    }`,
    maxTokens: 2000,
    effort: "low",
  });
}

export type AnswerScore = {
  relevance_score: number;
  clarity_score: number;
  star_score: number;
  metrics_score: number;
  conciseness_score: number;
  job_alignment_score: number;
  feedback: { strengths: string[]; improvements: string[]; filler_words_detected: string[] };
};

const SCORE_SYSTEM = `You score a candidate's spoken interview answer on several 0-10 dimensions: relevance to the question, clarity, STAR structure (if behavioral), use of concrete metrics, conciseness, and alignment to the target job. Give brief, constructive feedback. Return only JSON:
{ "relevance_score": number, "clarity_score": number, "star_score": number, "metrics_score": number, "conciseness_score": number, "job_alignment_score": number, "feedback": { "strengths": [string], "improvements": [string], "filler_words_detected": [string] } }`;

export async function scoreMockAnswer(question: string, answer: string, jobTitle?: string): Promise<AnswerScore> {
  return callClaudeJSON<AnswerScore>({
    system: SCORE_SYSTEM,
    prompt: `Target role: ${jobTitle ?? "unspecified"}\nQuestion: "${question}"\nCandidate's answer: "${answer}"`,
    maxTokens: 4000,
    effort: "medium",
  });
}
