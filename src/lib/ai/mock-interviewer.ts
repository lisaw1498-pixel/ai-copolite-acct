import { callClaudeJSON } from "./client";

export type MockInterviewerTurn = {
  message: string;
  is_follow_up: boolean;
  question_category: string;
  should_end: boolean;
};

const INTERVIEWER_SYSTEM_BASE = (difficulty: string, interviewType: string) => `You are role-playing as a professional job interviewer conducting a ${interviewType} mock interview, at a "${difficulty}" difficulty/tone.

You will be given the real job description, the real requirements for the role, and a summary of the candidate's actual background. Use them. A mock interview is only useful if it feels like the interview the candidate is about to walk into:
- Ask about the things this job actually requires, in the language the posting uses.
- Probe the candidate's real history - the gaps in it, the claims in it, the dates in it. If their background shows a requirement they may not meet, ask about it directly and fairly, the way a real hiring manager would.
- Where the candidate has supplied their own prepared questions, those are the interview. Ask them as written and work through the whole list; they wrote answers to match, and rehearsing those is the entire point of the session. Predicted questions are a fallback for when that list runs out.
- Never invent experience on the candidate's behalf, and never state their background back to them as fact unless it appears in what you were given.

Ask one question at a time. Keep your own turns short (1-3 sentences) like a real interviewer. You are speaking aloud, so sound like a person, not a script: contractions, the odd \"okay\", \"got it\", \"right\", \"interesting\" when reacting to what they just said, and no lists, headings, em dashes, or anything that only works on a page. React briefly to their answer before moving on, the way an actual interviewer does. Listen to (read) the candidate's answer, then either ask an intelligent follow-up that probes deeper into what they just said, or move to a new relevant question. Do not critique the candidate's answers inline unless explicitly asked to. Set should_end to true with a closing remark only once you are genuinely finished: if the candidate supplied a prepared list, that means you have worked through it; otherwise use your judgment, typically 6-12 questions. Never end while prepared questions remain unasked.

Return only JSON: { "message": string, "is_follow_up": boolean, "question_category": string, "should_end": boolean }`;

export async function nextMockInterviewerTurn(opts: {
  difficulty: string;
  interviewType: string;
  jobTitle?: string;
  company?: string;
  /** The real posting - what the candidate is actually preparing for. */
  jobDescription?: string | null;
  requirements?: { requirement: string; priority: string; candidateMatch?: string | null }[];
  /** Verified background, so the interviewer can probe the real history. */
  candidateSummary?: string | null;
  /** Who the candidate is actually meeting, if they have recorded it. */
  interviewer?: { name?: string | null; role?: string | null; notes?: string | null };
  /** Questions the candidate wrote themselves - ask these, as written. */
  myQuestions?: string[];
  /** Questions already predicted for this role - rehearsing these is the point. */
  likelyQuestions?: string[];
  transcript: { speaker: string; text: string }[];
}): Promise<MockInterviewerTurn> {
  const history = opts.transcript
    .map((t) => `${t.speaker === "ai_interviewer" ? "Interviewer" : "Candidate"}: ${t.text}`)
    .join("\n");

  const sections: string[] = [`Role: ${opts.jobTitle ?? "the target role"} at ${opts.company ?? "the company"}.`];

  if (opts.jobDescription?.trim()) {
    sections.push(`JOB DESCRIPTION:\n${opts.jobDescription.slice(0, 5000)}`);
  }
  if (opts.requirements?.length) {
    sections.push(
      `KEY REQUIREMENTS (candidate_match shows where their background is strong, transferable, or missing - probe the weak ones fairly):\n${opts.requirements
        .slice(0, 25)
        .map((r) => `- (${r.priority}${r.candidateMatch ? `, ${r.candidateMatch}` : ""}) ${r.requirement}`)
        .join("\n")}`
    );
  }
  const iv = opts.interviewer;
  if (iv && (iv.name || iv.role || iv.notes)) {
    sections.push(
      `YOU ARE PLAYING THIS PERSON (stay in character; do not mention these notes):\n${[
        iv.name && `Name: ${iv.name}`,
        iv.role && `Role: ${iv.role}`,
        iv.notes && `What the candidate knows about them: ${iv.notes}`,
      ]
        .filter(Boolean)
        .join("\n")}\nLet this shape what you press on. Someone with a clinical background probes different things than a technical lead.`
    );
  }
  if (opts.candidateSummary?.trim()) {
    sections.push(`CANDIDATE BACKGROUND (verified - do not contradict or embellish it):\n${opts.candidateSummary.slice(0, 4000)}`);
  }
  if (opts.myQuestions?.length) {
    sections.push(
      `QUESTIONS THE CANDIDATE PREPARED FOR THIS INTERVIEW - ASK THESE:\n${opts.myQuestions
        .slice(0, 25)
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}

These are the questions the candidate wrote and rehearsed answers for, so work through them rather than inventing your own. Ask each one essentially as written - you may adjust the opening words so it sounds spoken and follows on from what they just said, but keep the substance and the wording recognisable. Do not merge two of them into one question. Take them roughly in order, skipping any the conversation has already covered. A follow-up on an answer they just gave is fine and welcome, but return to this list afterwards. Only once you have worked through the list should you draw on the predicted questions below.`
    );
  }
  if (opts.likelyQuestions?.length) {
    sections.push(
      `${opts.myQuestions?.length ? "ADDITIONAL " : ""}LIKELY QUESTIONS PREDICTED FOR THIS ROLE (${
        opts.myQuestions?.length ? "only after the prepared list above is done" : "prefer these"
      }, varied and in your own voice):\n${opts.likelyQuestions
        .slice(0, 20)
        .map((q) => `- ${q}`)
        .join("\n")}`
    );
  }
  sections.push(`CONVERSATION SO FAR:\n${history || "(interview just starting - ask your opening question)"}`);

  return callClaudeJSON<MockInterviewerTurn>({
    system: INTERVIEWER_SYSTEM_BASE(opts.difficulty, opts.interviewType),
    prompt: sections.join("\n\n"),
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
