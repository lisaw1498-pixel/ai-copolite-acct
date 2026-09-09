CREATE TABLE `answer_fact_links` (
	`id` text PRIMARY KEY NOT NULL,
	`answer_id` text NOT NULL,
	`answer_source` text DEFAULT 'live',
	`candidate_fact_id` text,
	`claim_text` text NOT NULL,
	`verification_status_at_generation` text NOT NULL,
	`source` text,
	`created_at` integer
);

CREATE TABLE `candidate_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fact_type` text NOT NULL,
	`fact_key` text NOT NULL,
	`fact_value` text NOT NULL,
	`normalized_value` text,
	`source_type` text NOT NULL,
	`source_id` text,
	`source_document` text,
	`source_section` text,
	`source_excerpt` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`confidence_score` real DEFAULT 0.5,
	`user_confirmed` integer DEFAULT false,
	`importance` text DEFAULT 'normal',
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `candidate_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`professional_summary` text,
	`profile_json` text,
	`last_indexed_at` integer,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `career_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`employer_id` text,
	`category` text,
	`situation` text,
	`task` text,
	`action` text,
	`result` text,
	`metrics` text,
	`skills_json` text,
	`technology_json` text,
	`tags_json` text,
	`strength_score` integer,
	`verification_score` integer,
	`times_used` integer DEFAULT 0,
	`last_used_at` integer,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `employers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_name` text NOT NULL,
	`job_title` text,
	`start_date` text,
	`end_date` text,
	`description` text,
	`created_at` integer
);

CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`employer_id` text,
	`experience_type` text,
	`title` text NOT NULL,
	`description` text,
	`metrics_json` text,
	`technologies_json` text,
	`skills_json` text,
	`verified` integer DEFAULT false,
	`source` text DEFAULT 'user',
	`created_at` integer
);

CREATE TABLE `fact_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`candidate_fact_id` text NOT NULL,
	`conflicting_fact_id` text NOT NULL,
	`conflict_type` text,
	`status` text DEFAULT 'open',
	`resolution` text,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `interview_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`category` text,
	`likelihood` text,
	`difficulty` text,
	`generated` integer DEFAULT true,
	`created_at` integer
);

CREATE TABLE `interview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text,
	`session_type` text NOT NULL,
	`config_json` text,
	`started_at` integer,
	`ended_at` integer,
	`duration_seconds` integer,
	`status` text DEFAULT 'active',
	`report_error` text,
	`overall_score` real,
	`metadata_json` text
);

CREATE TABLE `interview_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`speaker` text NOT NULL,
	`raw_transcript` text,
	`cleaned_transcript` text,
	`question_detected` integer DEFAULT false,
	`question_category` text,
	`is_follow_up` integer DEFAULT false,
	`timestamp` integer,
	`created_at` integer
);

CREATE TABLE `job_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`requirement` text NOT NULL,
	`category` text,
	`priority` text,
	`required_or_preferred` text,
	`candidate_match` text,
	`candidate_evidence` text,
	`gap_type` text,
	`created_at` integer
);

CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resume_id` text,
	`company` text NOT NULL,
	`job_title` text NOT NULL,
	`location` text,
	`work_type` text,
	`salary_range` text,
	`job_description_raw` text,
	`job_description_parsed` text,
	`status` text DEFAULT 'interested',
	`interview_stage` text,
	`interview_date` text,
	`interview_time` text,
	`interviewer_name` text,
	`match_score` integer,
	`match_breakdown_json` text,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `live_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`interview_turn_id` text,
	`question` text NOT NULL,
	`question_type` text,
	`answer` text NOT NULL,
	`answer_length` text,
	`framework` text,
	`career_story_id` text,
	`talking_points_json` text,
	`verified_evidence_json` text,
	`excluded_claims_json` text,
	`transferable_json` text,
	`confidence` real,
	`generation_latency_ms` integer,
	`created_at` integer
);

CREATE TABLE `mock_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`interview_turn_id` text,
	`relevance_score` real,
	`clarity_score` real,
	`star_score` real,
	`metrics_score` real,
	`conciseness_score` real,
	`job_alignment_score` real,
	`feedback_json` text,
	`created_at` integer
);

CREATE TABLE `post_interview_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`summary` text,
	`strong_moments_json` text,
	`concerns_json` text,
	`repeated_themes_json` text,
	`employer_details_json` text,
	`next_steps_json` text,
	`thank_you_draft` text,
	`created_at` integer
);

CREATE TABLE `prepared_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`short_answer` text,
	`standard_answer` text,
	`long_answer` text,
	`star_answer_json` text,
	`talking_points_json` text,
	`career_story_id` text,
	`facts_used_json` text,
	`excluded_claims_json` text,
	`approved` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`file_name` text,
	`raw_text` text,
	`parsed_json` text,
	`is_default` integer DEFAULT false,
	`status` text DEFAULT 'processing',
	`status_message` text,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_name` text NOT NULL,
	`category` text,
	`years_experience` real,
	`proficiency` text,
	`verified` integer DEFAULT false,
	`evidence_json` text,
	`associated_employer_id` text,
	`created_at` integer
);

CREATE TABLE `story_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`career_story_id` text NOT NULL,
	`question_id` text,
	`used_at` integer
);

CREATE TABLE `technologies` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`technology_name` text NOT NULL,
	`category` text,
	`experience_level` text,
	`years_experience` real,
	`last_used` text,
	`verification_status` text DEFAULT 'unverified',
	`evidence_json` text,
	`created_at` integer
);

CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`theme` text DEFAULT 'light',
	`default_answer_length` text DEFAULT 'standard',
	`font_size` text DEFAULT 'medium',
	`quick_glance_enabled` integer DEFAULT true,
	`save_transcripts` integer DEFAULT true,
	`save_audio` integer DEFAULT false,
	`auto_delete_after` text DEFAULT 'never',
	`audio_preferences_json` text,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text,
	`current_title` text,
	`target_title` text,
	`industry` text,
	`years_experience` text,
	`linkedin_url` text,
	`onboarding_completed` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE `verification_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`candidate_fact_id` text NOT NULL,
	`review_action` text NOT NULL,
	`previous_status` text,
	`new_status` text,
	`created_at` integer
);
