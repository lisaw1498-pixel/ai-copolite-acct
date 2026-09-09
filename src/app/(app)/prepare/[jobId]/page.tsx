"use client";

import { useCallback, useEffect, useState, use } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

type Question = {
  id: string;
  question: string;
  category: string;
  likelihood: string;
  difficulty: string;
};

type Job = { id: string; company: string; jobTitle: string; matchScore: number | null };

const CATEGORY_ORDER = [
  "opening", "resume", "behavioral", "star", "technical", "leadership", "customer_success",
  "client_facing", "project_management", "gap", "culture", "motivation", "salary", "availability", "closing",
];

export default function InterviewPrepPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [jobRes, qRes] = await Promise.all([
      fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
      fetch(`/api/jobs/${jobId}/questions`).then((r) => r.json()),
    ]);
    setJob(jobRes.job);
    setQuestions(qRes.questions || []);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateQuestions() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/questions`, { method: "POST" });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error || "Couldn't generate questions.");
      return;
    }
    load();
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: questions.filter((q) => q.category?.toLowerCase().replace(/\s/g, "_") === cat),
  })).filter((g) => g.items.length > 0);
  const uncategorized = questions.filter(
    (q) => !CATEGORY_ORDER.includes(q.category?.toLowerCase().replace(/\s/g, "_"))
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title={job ? `Prepare for ${job.company} — ${job.jobTitle}` : "Interview Prep"}
        subtitle="Generate likely questions and grounded, verified answers."
        action={
          <Button onClick={generateQuestions} disabled={generating}>
            <Sparkles size={14} /> {generating ? "Generating..." : questions.length ? "Regenerate Questions" : "Generate Questions"}
          </Button>
        }
      />

      {error && <p className="text-sm text-brand-danger">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Match Score" value={job?.matchScore != null ? `${job.matchScore}%` : "—"} tone="blue" />
        <StatCard label="Questions Generated" value={questions.length} tone="teal" />
        <Button variant="secondary" href={`/jobs/${jobId}`} className="h-full flex-col justify-center">
          Review Verified Experience
        </Button>
      </div>

      {questions.length === 0 && !generating && (
        <Card className="p-8 text-center text-sm text-navy/50">
          No questions yet — click &quot;Generate Questions&quot; to get a personalized set based on this job and
          your verified experience.
        </Card>
      )}

      {[...grouped, ...(uncategorized.length ? [{ cat: "other", items: uncategorized }] : [])].map((g) => (
        <Card key={g.cat}>
          <CardHeader title={g.cat.replace(/_/g, " ")} subtitle={`${g.items.length} question(s)`} />
          <div className="divide-y divide-surface-border">
            {g.items.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-navy truncate">{q.question}</p>
                  <div className="mt-1 flex gap-1.5">
                    <Pill tone={q.likelihood === "high" ? "green" : q.likelihood === "medium" ? "amber" : "neutral"}>
                      {q.likelihood} likelihood
                    </Pill>
                    <Pill>{q.difficulty}</Pill>
                  </div>
                </div>
                <Button variant="secondary" href={`/prepare/${jobId}/answers/${q.id}`}>
                  Generate Answer
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
