"use client";

import { useCallback, useEffect, useState, use } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

type Requirement = {
  id: string;
  requirement: string;
  category: string | null;
  priority: string | null;
  candidateMatch: string | null;
  candidateEvidence: string | null;
};

type Job = {
  id: string;
  company: string;
  jobTitle: string;
  matchScore: number | null;
  matchBreakdownJson: { score_breakdown?: Record<string, number> } | null;
  jobDescriptionRaw: string | null;
};

const MATCH_LABEL: Record<string, { label: string; tone: "green" | "blue" | "amber" | "red" }> = {
  verified: { label: "✓ Verified Match", tone: "green" },
  transferable: { label: "↔ Transferable Match", tone: "blue" },
  unverified: { label: "! Unverified — Needs Confirmation", tone: "amber" },
  true_gap: { label: "True Gap", tone: "red" },
};

export default function JobAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    const data = await res.json();
    setJob(data.job);
    setRequirements(data.requirements || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function reanalyze() {
    setReanalyzing(true);
    await fetch(`/api/jobs/${id}/reanalyze`, { method: "POST" });
    setReanalyzing(false);
    load();
  }

  if (loading) return <div className="p-8 text-sm text-navy/50">Loading...</div>;
  if (!job) return <div className="p-8 text-sm text-navy/50">Job not found.</div>;

  const groups = {
    verified: requirements.filter((r) => r.candidateMatch === "verified"),
    transferable: requirements.filter((r) => r.candidateMatch === "transferable"),
    unverified: requirements.filter((r) => r.candidateMatch === "unverified"),
    true_gap: requirements.filter((r) => r.candidateMatch === "true_gap"),
  };

  const breakdown = job.matchBreakdownJson?.score_breakdown;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title={`${job.jobTitle} — ${job.company}`}
        subtitle="Job-specific Verified Experience Check"
        action={
          <Button variant="secondary" onClick={reanalyze} disabled={reanalyzing}>
            <RefreshCw size={14} className={reanalyzing ? "animate-spin" : ""} /> Re-run match
          </Button>
        }
      />

      <Card className="p-6 text-center">
        <p className="text-5xl font-semibold text-brand-blue">{job.matchScore ?? "—"}%</p>
        <p className="text-sm text-navy/50 mt-1">Overall Match</p>
      </Card>

      {breakdown && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(breakdown).map(([k, v]) => (
            <StatCard key={k} label={k.replace(/_/g, " ")} value={`${Math.round(v)}%`} tone="blue" />
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Verified matches" subtitle={`${groups.verified.length} requirement(s) directly supported`} />
        <ReqList items={groups.verified} />
      </Card>
      <Card>
        <CardHeader title="Transferable matches" subtitle={`${groups.transferable.length} requirement(s) with comparable experience`} />
        <ReqList items={groups.transferable} />
      </Card>
      <Card>
        <CardHeader title="Unverified matches" subtitle="Needs your confirmation before it can appear in an answer" />
        <ReqList items={groups.unverified} />
      </Card>
      <Card>
        <CardHeader title="True gaps" subtitle="No candidate evidence found — prepare a truthful bridge response" />
        <ReqList items={groups.true_gap} />
      </Card>

      <div className="flex justify-end">
        <Button href={`/prepare/${job.id}`}>Prepare for This Interview</Button>
      </div>
    </div>
  );
}

function ReqList({ items }: { items: Requirement[] }) {
  if (items.length === 0) return <p className="p-5 text-sm text-navy/40">None in this category.</p>;
  return (
    <div className="divide-y divide-surface-border">
      {items.map((r) => {
        const meta = MATCH_LABEL[r.candidateMatch ?? ""] ?? { label: r.candidateMatch ?? "unknown", tone: "amber" as const };
        return (
          <div key={r.id} className="px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-navy">{r.requirement}</p>
              <Pill tone={meta.tone}>{meta.label}</Pill>
            </div>
            {r.candidateEvidence && <p className="mt-1 text-xs text-navy/50">{r.candidateEvidence}</p>}
            <p className="mt-1 text-[11px] text-navy/30 capitalize">{r.category} · {r.priority}</p>
          </div>
        );
      })}
    </div>
  );
}
