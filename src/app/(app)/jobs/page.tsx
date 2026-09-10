"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Plus, X, Trash2 } from "lucide-react";

type Job = {
  id: string;
  company: string;
  jobTitle: string;
  location: string | null;
  status: string;
  interviewStage: string | null;
  interviewDate: string | null;
  matchScore: number | null;
};

const STATUS_TONE: Record<string, "neutral" | "blue" | "teal" | "amber" | "green" | "red"> = {
  interested: "neutral",
  applied: "blue",
  recruiter_screen: "blue",
  hiring_manager: "teal",
  technical_interview: "teal",
  panel: "teal",
  final_interview: "amber",
  offer: "green",
  rejected: "red",
  withdrawn: "neutral",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", jobTitle: "", location: "", jobDescriptionRaw: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Couldn't add that job.");
      return;
    }
    setForm({ company: "", jobTitle: "", location: "", jobDescriptionRaw: "" });
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't delete that job.");
      return;
    }
    setConfirmingDelete(null);
    load();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="My Job Opportunities"
        subtitle="Upload or paste a job description to get an instant Verified Experience match."
        action={<Button onClick={() => setShowForm(true)}><Plus size={15} /> Add Job</Button>}
      />

      {showForm && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy">Add a job</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-navy/40" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <input className="input" placeholder="Job Title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <textarea
            className="input"
            rows={8}
            placeholder="Paste the job description..."
            value={form.jobDescriptionRaw}
            onChange={(e) => setForm({ ...form, jobDescriptionRaw: e.target.value })}
          />
          {error && <p className="text-sm text-brand-danger">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving || !form.jobDescriptionRaw.trim()}>
              {saving ? "Analyzing..." : "Analyze This Job"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {jobs.map((j) => (
          <Card key={j.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-navy">{j.jobTitle}</p>
                <p className="text-xs text-navy/50">{j.company}{j.location ? ` · ${j.location}` : ""}</p>
              </div>
              <div className="flex items-start gap-3 shrink-0">
                {typeof j.matchScore === "number" && (
                  <div className="text-right">
                    <p className="text-xl font-semibold text-brand-blue">{j.matchScore}%</p>
                    <p className="text-[10px] text-navy/40">Match</p>
                  </div>
                )}
                <button
                  onClick={() => setConfirmingDelete(j.id)}
                  title="Delete this job"
                  aria-label={`Delete ${j.jobTitle} at ${j.company}`}
                  className="mt-0.5 text-navy/30 hover:text-brand-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Pill tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status.replace(/_/g, " ")}</Pill>
              {j.interviewStage && <Pill>{j.interviewStage}</Pill>}
              {j.interviewDate && <Pill>{j.interviewDate}</Pill>}
            </div>
            {confirmingDelete === j.id ? (
              <div className="mt-3 rounded-lg border border-brand-danger/30 bg-brand-danger/5 p-3">
                <p className="text-sm text-navy">Delete this job?</p>
                <p className="mt-0.5 text-xs text-navy/60">
                  Its questions, prepared answers, interviewer notes and any practice sessions go
                  with it. Your resume and story bank are not affected.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <Button
                    variant="danger"
                    onClick={() => remove(j.id)}
                    disabled={deleting === j.id}
                  >
                    {deleting === j.id ? "Deleting..." : "Yes, delete"}
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(null)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button href={`/jobs/${j.id}/prep`}>Interview Hub</Button>
                <Button variant="secondary" href={`/jobs/${j.id}`}>Analyze</Button>
                <Button variant="secondary" href={`/prepare/${j.id}`}>Prepare</Button>
                <Button href="/live">Open Interview</Button>
              </div>
            )}
          </Card>
        ))}
        {jobs.length === 0 && !showForm && (
          <p className="text-sm text-navy/50">No job opportunities yet — add one above.</p>
        )}
      </div>

      <style jsx global>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgba(37,99,235,0.25); }
      `}</style>
    </div>
  );
}
