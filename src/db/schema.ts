import { randomUUID } from "crypto";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const now = () =>
  integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date());

/* ---------------------------------------------------------------------- */
/* Users & settings                                                        */
/* ---------------------------------------------------------------------- */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  currentTitle: text("current_title"),
  targetTitle: text("target_title"),
  industry: text("industry"),
  yearsExperience: text("years_experience"),
  linkedinUrl: text("linkedin_url"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).default(false),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const userSettings = sqliteTable("user_settings", {
  id: id(),
  userId: text("user_id").notNull().unique(),
  theme: text("theme").default("light"),
  defaultAnswerLength: text("default_answer_length").default("standard"),
  fontSize: text("font_size").default("medium"),
  quickGlanceEnabled: integer("quick_glance_enabled", { mode: "boolean" }).default(true),
  saveTranscripts: integer("save_transcripts", { mode: "boolean" }).default(true),
  saveAudio: integer("save_audio", { mode: "boolean" }).default(false),
  autoDeleteAfter: text("auto_delete_after").default("never"),
  audioPreferencesJson: text("audio_preferences_json", { mode: "json" }),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/* ---------------------------------------------------------------------- */
/* Resumes & candidate profile                                             */
/* ---------------------------------------------------------------------- */

export const resumes = sqliteTable("resumes", {
  id: id(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  fileName: text("file_name"),
  rawText: text("raw_text"),
  parsedJson: text("parsed_json", { mode: "json" }),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  status: text("status").default("processing"), // processing | analyzed | failed
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const candidateProfiles = sqliteTable("candidate_profiles", {
  id: id(),
  userId: text("user_id").notNull().unique(),
  professionalSummary: text("professional_summary"),
  profileJson: text("profile_json", { mode: "json" }),
  lastIndexedAt: integer("last_indexed_at", { mode: "timestamp" }),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const employers = sqliteTable("employers", {
  id: id(),
  userId: text("user_id").notNull(),
  companyName: text("company_name").notNull(),
  jobTitle: text("job_title"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
  createdAt: now(),
});

export const experiences = sqliteTable("experiences", {
  id: id(),
  userId: text("user_id").notNull(),
  employerId: text("employer_id"),
  experienceType: text("experience_type"), // project, accomplishment, responsibility, leadership...
  title: text("title").notNull(),
  description: text("description"),
  metricsJson: text("metrics_json", { mode: "json" }),
  technologiesJson: text("technologies_json", { mode: "json" }),
  skillsJson: text("skills_json", { mode: "json" }),
  verified: integer("verified", { mode: "boolean" }).default(false),
  source: text("source").default("user"), // resume | user | ai_suggested
  createdAt: now(),
});

/* ---------------------------------------------------------------------- */
/* Career stories, skills, technologies                                    */
/* ---------------------------------------------------------------------- */

export const careerStories = sqliteTable("career_stories", {
  id: id(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  employerId: text("employer_id"),
  category: text("category"),
  situation: text("situation"),
  task: text("task"),
  action: text("action"),
  result: text("result"),
  metrics: text("metrics"),
  skillsJson: text("skills_json", { mode: "json" }),
  technologyJson: text("technology_json", { mode: "json" }),
  tagsJson: text("tags_json", { mode: "json" }),
  strengthScore: integer("strength_score"),
  verificationScore: integer("verification_score"),
  timesUsed: integer("times_used").default(0),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const skills = sqliteTable("skills", {
  id: id(),
  userId: text("user_id").notNull(),
  skillName: text("skill_name").notNull(),
  category: text("category"),
  yearsExperience: real("years_experience"),
  proficiency: text("proficiency"),
  verified: integer("verified", { mode: "boolean" }).default(false),
  evidenceJson: text("evidence_json", { mode: "json" }),
  associatedEmployerId: text("associated_employer_id"),
  createdAt: now(),
});

export const technologies = sqliteTable("technologies", {
  id: id(),
  userId: text("user_id").notNull(),
  technologyName: text("technology_name").notNull(),
  category: text("category"), // EHR, CRM, Cloud, Programming...
  experienceLevel: text("experience_level"), // expert|advanced|intermediate|working_knowledge|exposure|transferable|no_direct_experience
  yearsExperience: real("years_experience"),
  lastUsed: text("last_used"),
  verificationStatus: text("verification_status").default("unverified"),
  evidenceJson: text("evidence_json", { mode: "json" }),
  createdAt: now(),
});

/* ---------------------------------------------------------------------- */
/* Verified Experience Layer                                               */
/* ---------------------------------------------------------------------- */

export const candidateFacts = sqliteTable("candidate_facts", {
  id: id(),
  userId: text("user_id").notNull(),
  factType: text("fact_type").notNull(),
  factKey: text("fact_key").notNull(),
  factValue: text("fact_value").notNull(),
  normalizedValue: text("normalized_value"),
  sourceType: text("source_type").notNull(), // resume | career_story | user_confirmed | project | approved_answer
  sourceId: text("source_id"),
  sourceDocument: text("source_document"),
  sourceSection: text("source_section"),
  sourceExcerpt: text("source_excerpt"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  // verified_resume | verified_story | verified_user | verified_project | verified_approved |
  // transferable | unverified | conflicted
  confidenceScore: real("confidence_score").default(0.5),
  userConfirmed: integer("user_confirmed", { mode: "boolean" }).default(false),
  importance: text("importance").default("normal"), // for job-specific ranking
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const factConflicts = sqliteTable("fact_conflicts", {
  id: id(),
  userId: text("user_id").notNull(),
  candidateFactId: text("candidate_fact_id").notNull(),
  conflictingFactId: text("conflicting_fact_id").notNull(),
  conflictType: text("conflict_type"),
  status: text("status").default("open"), // open | resolved
  resolution: text("resolution"),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const verificationReviews = sqliteTable("verification_reviews", {
  id: id(),
  userId: text("user_id").notNull(),
  candidateFactId: text("candidate_fact_id").notNull(),
  reviewAction: text("review_action").notNull(), // confirm | reject | edit | merge | mark_transferable
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  createdAt: now(),
});

/* ---------------------------------------------------------------------- */
/* Jobs                                                                     */
/* ---------------------------------------------------------------------- */

export const jobs = sqliteTable("jobs", {
  id: id(),
  userId: text("user_id").notNull(),
  resumeId: text("resume_id"),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  location: text("location"),
  workType: text("work_type"),
  salaryRange: text("salary_range"),
  jobDescriptionRaw: text("job_description_raw"),
  jobDescriptionParsed: text("job_description_parsed", { mode: "json" }),
  status: text("status").default("interested"),
  interviewStage: text("interview_stage"),
  interviewDate: text("interview_date"),
  interviewTime: text("interview_time"),
  interviewerName: text("interviewer_name"),
  matchScore: integer("match_score"),
  matchBreakdownJson: text("match_breakdown_json", { mode: "json" }),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const jobRequirements = sqliteTable("job_requirements", {
  id: id(),
  jobId: text("job_id").notNull(),
  requirement: text("requirement").notNull(),
  category: text("category"),
  priority: text("priority"), // required | preferred
  requiredOrPreferred: text("required_or_preferred"),
  candidateMatch: text("candidate_match"), // verified | transferable | unverified | true_gap
  candidateEvidence: text("candidate_evidence"),
  gapType: text("gap_type"),
  createdAt: now(),
});

/* ---------------------------------------------------------------------- */
/* Questions & answers                                                     */
/* ---------------------------------------------------------------------- */

export const interviewQuestions = sqliteTable("interview_questions", {
  id: id(),
  jobId: text("job_id"),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  category: text("category"),
  likelihood: text("likelihood"),
  difficulty: text("difficulty"),
  generated: integer("generated", { mode: "boolean" }).default(true),
  createdAt: now(),
});

export const preparedAnswers = sqliteTable("prepared_answers", {
  id: id(),
  questionId: text("question_id").notNull(),
  userId: text("user_id").notNull(),
  shortAnswer: text("short_answer"),
  standardAnswer: text("standard_answer"),
  longAnswer: text("long_answer"),
  starAnswerJson: text("star_answer_json", { mode: "json" }),
  talkingPointsJson: text("talking_points_json", { mode: "json" }),
  careerStoryId: text("career_story_id"),
  factsUsedJson: text("facts_used_json", { mode: "json" }),
  excludedClaimsJson: text("excluded_claims_json", { mode: "json" }),
  approved: integer("approved", { mode: "boolean" }).default(false),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/* ---------------------------------------------------------------------- */
/* Interview sessions (mock + live)                                        */
/* ---------------------------------------------------------------------- */

export const interviewSessions = sqliteTable("interview_sessions", {
  id: id(),
  userId: text("user_id").notNull(),
  jobId: text("job_id"),
  sessionType: text("session_type").notNull(), // mock | live
  configJson: text("config_json", { mode: "json" }),
  startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  durationSeconds: integer("duration_seconds"),
  status: text("status").default("active"), // active | ended
  overallScore: real("overall_score"),
  metadataJson: text("metadata_json", { mode: "json" }),
});

export const interviewTurns = sqliteTable("interview_turns", {
  id: id(),
  sessionId: text("session_id").notNull(),
  speaker: text("speaker").notNull(), // interviewer | candidate | unknown | ai_interviewer
  rawTranscript: text("raw_transcript"),
  cleanedTranscript: text("cleaned_transcript"),
  questionDetected: integer("question_detected", { mode: "boolean" }).default(false),
  questionCategory: text("question_category"),
  isFollowUp: integer("is_follow_up", { mode: "boolean" }).default(false),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: now(),
});

export const liveAnswers = sqliteTable("live_answers", {
  id: id(),
  sessionId: text("session_id").notNull(),
  interviewTurnId: text("interview_turn_id"),
  question: text("question").notNull(),
  questionType: text("question_type"),
  answer: text("answer").notNull(),
  answerLength: text("answer_length"),
  framework: text("framework"),
  careerStoryId: text("career_story_id"),
  talkingPointsJson: text("talking_points_json", { mode: "json" }),
  verifiedEvidenceJson: text("verified_evidence_json", { mode: "json" }),
  excludedClaimsJson: text("excluded_claims_json", { mode: "json" }),
  transferableJson: text("transferable_json", { mode: "json" }),
  confidence: real("confidence"),
  generationLatencyMs: integer("generation_latency_ms"),
  createdAt: now(),
});

export const answerFactLinks = sqliteTable("answer_fact_links", {
  id: id(),
  answerId: text("answer_id").notNull(),
  answerSource: text("answer_source").default("live"), // live | prepared
  candidateFactId: text("candidate_fact_id"),
  claimText: text("claim_text").notNull(),
  verificationStatusAtGeneration: text("verification_status_at_generation").notNull(),
  source: text("source"),
  createdAt: now(),
});

export const storyUsage = sqliteTable("story_usage", {
  id: id(),
  sessionId: text("session_id").notNull(),
  careerStoryId: text("career_story_id").notNull(),
  questionId: text("question_id"),
  usedAt: integer("used_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const mockScores = sqliteTable("mock_scores", {
  id: id(),
  sessionId: text("session_id").notNull(),
  interviewTurnId: text("interview_turn_id"),
  relevanceScore: real("relevance_score"),
  clarityScore: real("clarity_score"),
  starScore: real("star_score"),
  metricsScore: real("metrics_score"),
  concisenessScore: real("conciseness_score"),
  jobAlignmentScore: real("job_alignment_score"),
  feedbackJson: text("feedback_json", { mode: "json" }),
  createdAt: now(),
});

export const postInterviewReports = sqliteTable("post_interview_reports", {
  id: id(),
  sessionId: text("session_id").notNull().unique(),
  summary: text("summary"),
  strongMomentsJson: text("strong_moments_json", { mode: "json" }),
  concernsJson: text("concerns_json", { mode: "json" }),
  repeatedThemesJson: text("repeated_themes_json", { mode: "json" }),
  employerDetailsJson: text("employer_details_json", { mode: "json" }),
  nextStepsJson: text("next_steps_json", { mode: "json" }),
  thankYouDraft: text("thank_you_draft"),
  createdAt: now(),
});
