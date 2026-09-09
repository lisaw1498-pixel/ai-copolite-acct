// Interview Readiness scoring.
//
// The dashboard previously reported a flat percentage from four booleans, which
// could show "100% Interview Ready" to someone who had never uploaded a resume
// or run a mock interview. A readiness number that overstates preparation is
// worse than none at all, so each of the blueprint's eight categories is scored
// on its own evidence and contributes a partial, weighted result.

export type ReadinessCategory = {
  label: string;
  /** 0-1. Partial credit is deliberate: two stories is real progress, not a fail. */
  score: number;
  detail: string;
};

export type ReadinessInput = {
  analyzedResumes: number;
  verifiedFacts: number;
  unresolvedFacts: number;
  stories: number;
  behavioralAnswers: number;
  technicalAnswers: number;
  jobsWithParsedDescription: number;
  questionsToAsk: number;
  completedMockSessions: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeReadiness(input: ReadinessInput): {
  score: number;
  categories: ReadinessCategory[];
  recommendation: string | null;
} {
  const categories: ReadinessCategory[] = [
    {
      label: "Resume Alignment",
      score: input.analyzedResumes > 0 ? 1 : 0,
      detail: input.analyzedResumes > 0 ? "Resume analyzed" : "Upload and analyze a resume",
    },
    {
      label: "Verified Experience",
      // Full credit needs a real body of verified facts, and unresolved items
      // pull the score down because they are excluded from live answers.
      score:
        clamp01(input.verifiedFacts / 25) *
        clamp01(1 - input.unresolvedFacts / Math.max(input.verifiedFacts, 10)),
      detail:
        input.unresolvedFacts > 0
          ? `${input.verifiedFacts} verified, ${input.unresolvedFacts} need review`
          : `${input.verifiedFacts} verified facts`,
    },
    {
      label: "Career Stories",
      score: clamp01(input.stories / 6),
      detail: `${input.stories} of a recommended 6 STAR stories`,
    },
    {
      label: "Behavioral Preparation",
      score: clamp01(input.behavioralAnswers / 5),
      detail: `${input.behavioralAnswers} behavioral answers prepared`,
    },
    {
      label: "Technical Preparation",
      score: clamp01(input.technicalAnswers / 4),
      detail: `${input.technicalAnswers} technical answers prepared`,
    },
    {
      label: "Company Research",
      score: input.jobsWithParsedDescription > 0 ? 1 : 0,
      detail:
        input.jobsWithParsedDescription > 0
          ? "Job description analyzed"
          : "Add and analyze a job description",
    },
    {
      label: "Questions to Ask",
      score: clamp01(input.questionsToAsk / 3),
      detail: `${input.questionsToAsk} questions ready for the interviewer`,
    },
    {
      label: "Mock Interview Completion",
      score: clamp01(input.completedMockSessions / 1),
      detail:
        input.completedMockSessions > 0
          ? `${input.completedMockSessions} completed`
          : "No mock interview completed yet",
    },
  ];

  const score = Math.round(
    (categories.reduce((sum, c) => sum + c.score, 0) / categories.length) * 100
  );

  // Point at the single weakest area rather than listing everything at once.
  const weakest = [...categories].sort((a, b) => a.score - b.score)[0];
  const recommendation =
    weakest && weakest.score < 1 ? `${weakest.label}: ${weakest.detail}.` : null;

  return { score, categories, recommendation };
}
