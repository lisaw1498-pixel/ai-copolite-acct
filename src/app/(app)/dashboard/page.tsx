import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { db } from "@/db/client";
import {
  candidateFacts,
  careerStories,
  jobs,
  interviewSessions,
  resumes,
  interviewQuestions,
  preparedAnswers,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isVerified } from "@/lib/verification";
import { computeReadiness } from "@/lib/readiness";
import { Radio, Mic, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();

  const facts = db.select().from(candidateFacts).where(eq(candidateFacts.userId, user.id)).all();
  const stories = db.select().from(careerStories).where(eq(careerStories.userId, user.id)).all();
  const allJobs = db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, user.id))
    .orderBy(desc(jobs.createdAt))
    .all();
  const sessions = db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, user.id))
    .orderBy(desc(interviewSessions.startedAt))
    .limit(5)
    .all();

  const verifiedFacts = facts.filter((f) => isVerified(f.verificationStatus)).length;
  const needsReview = facts.filter((f) => f.verificationStatus === "unverified" || f.verificationStatus === "conflicted").length;
  const transferable = facts.filter((f) => f.verificationStatus === "transferable").length;

  const upcoming = allJobs.find((j) => j.interviewDate) || allJobs[0];

  // Readiness is scored from actual prepared artefacts, not from "any row
  // exists" - see src/lib/readiness.ts.
  const userResumes = db.select().from(resumes).where(eq(resumes.userId, user.id)).all();
  const questions = db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.userId, user.id))
    .all();
  const answers = db.select().from(preparedAnswers).where(eq(preparedAnswers.userId, user.id)).all();
  const allSessions = db
    .select()
    .from(interviewSessions)
    .where(eq(interviewSessions.userId, user.id))
    .all();

  const answeredQuestionIds = new Set(answers.map((a) => a.questionId));
  const countAnsweredIn = (categories: string[]) =>
    questions.filter(
      (q) => answeredQuestionIds.has(q.id) && categories.includes((q.category ?? "").toLowerCase())
    ).length;

  const { score: readiness, categories: readinessCategories, recommendation } = computeReadiness({
    analyzedResumes: userResumes.filter((r) => r.status === "analyzed").length,
    verifiedFacts,
    unresolvedFacts: needsReview,
    stories: stories.length,
    behavioralAnswers: countAnsweredIn(["behavioral", "star", "leadership", "conflict"]),
    technicalAnswers: countAnsweredIn(["technical"]),
    jobsWithParsedDescription: allJobs.filter((j) => j.jobDescriptionRaw).length,
    questionsToAsk: questions.filter((q) => (q.category ?? "").toLowerCase() === "questions_to_ask")
      .length,
    completedMockSessions: allSessions.filter(
      (x) => x.sessionType === "mock" && x.status === "ended"
    ).length,
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${
          (user.fullName || user.email).split(" ")[0]
        }`}
        subtitle="Ready for your next interview?"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" href="/practice">
              <Mic size={15} /> Practice Interview
            </Button>
            <Button href="/live">
              <Radio size={15} /> Launch Live Interview
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Verified Facts" value={verifiedFacts} tone="green" />
        <StatCard label="Career Stories" value={stories.length} tone="blue" />
        <StatCard label="Transferable Skills" value={transferable} tone="teal" />
        <StatCard label="Need Review" value={needsReview} tone="amber" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader
            title="Upcoming interview"
            action={
              upcoming && (
                <div className="flex gap-2">
                  <Button variant="secondary" href={`/prepare/${upcoming.id}`}>
                    Prepare
                  </Button>
                  <Button href="/live">Launch Copilot</Button>
                </div>
              )
            }
          />
          <div className="p-5">
            {!upcoming && (
              <div className="text-sm text-navy/60">
                No jobs yet.{" "}
                <Link href="/jobs" className="text-brand-blue hover:underline font-medium">
                  Add your first job opportunity
                </Link>{" "}
                to get started.
              </div>
            )}
            {upcoming && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {upcoming.jobTitle} — {upcoming.company}
                  </p>
                  <p className="text-xs text-navy/50 mt-1">
                    {upcoming.interviewDate ? `${upcoming.interviewDate} ${upcoming.interviewTime ?? ""}` : "No date set"} ·{" "}
                    {upcoming.interviewStage || "Stage not set"}
                    {upcoming.interviewerName ? ` · with ${upcoming.interviewerName}` : ""}
                  </p>
                </div>
                {typeof upcoming.matchScore === "number" && (
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-brand-blue">{upcoming.matchScore}%</p>
                    <p className="text-xs text-navy/50">Match Score</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Interview readiness" />
          <div className="p-5">
            <p className="text-3xl font-semibold text-brand-teal">{readiness}%</p>
            <p className="text-xs text-navy/50 mt-1">Interview Ready</p>
            <ul className="mt-4 space-y-1.5 text-xs text-navy/60">
              {readinessCategories.map((c) => (
                <li key={c.label} className="flex items-baseline justify-between gap-2">
                  <span>
                    {c.score >= 1 ? "✓" : c.score > 0 ? "◐" : "○"} {c.label}
                  </span>
                  <span className="text-navy/35 text-[11px] text-right shrink-0">{c.detail}</span>
                </li>
              ))}
            </ul>
            {recommendation && (
              <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-[11px] text-navy/60">
                Next: {recommendation}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent interviews" action={<Button variant="ghost" href="/history">View all <ArrowRight size={14}/></Button>} />
        <div className="divide-y divide-surface-border">
          {sessions.length === 0 && <p className="p-5 text-sm text-navy/50">No interviews yet.</p>}
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-navy/70 capitalize">{s.sessionType} interview</span>
              <span className="text-navy/40 text-xs">
                {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : ""} · {s.status}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button variant="secondary" href="/jobs">Add Job</Button>
        <Button variant="secondary" href="/profile/career-stories">Add Career Story</Button>
        <Button variant="secondary" href="/practice">Practice Interview</Button>
        <Button variant="secondary" href="/prepare/questions">Generate Questions</Button>
      </div>
    </div>
  );
}
