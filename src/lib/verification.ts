// Central vocabulary for the Verified Experience Layer's badges & statuses.
// Keeping this in one place means every screen renders the same label/icon/color
// for a given verification_status.

export type VerificationStatus =
  | "verified_resume"
  | "verified_story"
  | "verified_user"
  | "verified_project"
  | "verified_approved"
  | "transferable"
  | "unverified"
  | "conflicted";

export const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; symbol: string; className: string; description: string }
> = {
  verified_resume: {
    label: "Resume Verified",
    symbol: "✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Extracted directly from the candidate's uploaded resume.",
  },
  verified_story: {
    label: "Story Verified",
    symbol: "✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Explicitly entered by the candidate into a Career Story.",
  },
  verified_user: {
    label: "User Confirmed",
    symbol: "✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Manually entered or explicitly approved by the candidate.",
  },
  verified_project: {
    label: "Project Verified",
    symbol: "✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Stored inside a candidate-created Project Record.",
  },
  verified_approved: {
    label: "Previously Approved",
    symbol: "✓",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Appeared in an interview response the candidate reviewed and approved.",
  },
  transferable: {
    label: "Transferable",
    symbol: "↔",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    description: "No exact match, but verified comparable experience exists.",
  },
  unverified: {
    label: "Unverified",
    symbol: "!",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    description: "May be inferred by AI but lacks sufficient evidence.",
  },
  conflicted: {
    label: "Needs Review",
    symbol: "!",
    className: "bg-red-50 text-red-700 border-red-200",
    description: "Two candidate sources contain contradictory information.",
  },
};

export function isVerified(status: string): boolean {
  return status.startsWith("verified_");
}

export const FACT_TYPES = [
  "employer",
  "job_title",
  "employment_dates",
  "years_experience",
  "industry_experience",
  "project",
  "responsibility",
  "accomplishment",
  "metric",
  "team_size",
  "budget",
  "technology",
  "software",
  "crm",
  "ehr",
  "certification",
  "education",
  "leadership",
  "client_experience",
  "implementation_experience",
  "methodology",
  "process_improvement",
  "revenue_impact",
  "customer_satisfaction",
  "training",
  "go_live_experience",
  "regulatory_knowledge",
  "technical_skill",
  "soft_skill",
] as const;

// Fact types that require especially strict, explicit evidence before they can
// be marked verified (Metric Protection / Technology Experience Protection).
export const STRICT_FACT_TYPES = new Set([
  "metric",
  "years_experience",
  "technology",
  "software",
  "crm",
  "ehr",
  "employer",
  "job_title",
  "budget",
  "team_size",
  "certification",
  "revenue_impact",
  "customer_satisfaction",
]);
