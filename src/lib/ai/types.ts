export type FactForPrompt = {
  id: string;
  factType: string;
  factKey: string;
  factValue: string;
  normalizedValue?: string | null;
  verificationStatus: string;
  sourceType: string;
  sourceExcerpt?: string | null;
};

export type StoryForPrompt = {
  id: string;
  title: string;
  category?: string | null;
  situation?: string | null;
  task?: string | null;
  action?: string | null;
  result?: string | null;
  metrics?: string | null;
  verificationScore?: number | null;
  timesUsed?: number | null;
};

export type GeneratedAnswer = {
  question_type: string;
  framework: string;
  story_id: string | null;
  say_this: string;
  remember_this: { label: string; value: string; verification?: string }[];
  facts_used: { fact_id: string; claim: string; verification_status: string; source: string }[];
  transferable_experience: { requirement: string; candidate_equivalent: string }[];
  excluded_unverified_claims: string[];
  verified_metrics: string[];
  confidence: number;
  is_follow_up: boolean;
};
