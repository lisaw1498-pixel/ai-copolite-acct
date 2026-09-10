"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Briefcase, ChevronDown, ChevronRight } from "lucide-react";

type Employer = {
  id: string;
  companyName: string;
  jobTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  sourceResumeId: string | null;
};
type Experience = {
  id: string;
  employerId: string | null;
  experienceType: string | null;
  title: string;
  description: string | null;
  verified: boolean | null;
  source: string | null;
};
type Resume = { id: string; name: string; isDefault: boolean | null; status: string };

const EXPERIENCE_TYPES = [
  "project", "accomplishment", "responsibility", "leadership", "difficult_client", "conflict",
  "process_improvement", "implementation", "metric", "budget", "team_size", "training",
  "go_live", "change_management", "customer_success", "sales", "operational",
];

export default function ExperiencePage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeFilter, setResumeFilter] = useState<string>("");

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showEmployerForm, setShowEmployerForm] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const [employerForm, setEmployerForm] = useState({ companyName: "", jobTitle: "", startDate: "", endDate: "", description: "" });
  const [expForm, setExpForm] = useState({ title: "", experienceType: "project", description: "" });

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([
      fetch("/api/employers").then((x) => x.json()),
      fetch("/api/resumes").then((x) => x.json()),
    ]);
    setEmployers(e.employers || []);
    setExperiences(e.experiences || []);
    const list: Resume[] = (r.resumes || []).filter((x: Resume) => x.status === "analyzed");
    setResumes(list);
    setResumeFilter((prev) => prev || list.find((x) => x.isDefault)?.id || list[0]?.id || "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEmployer() {
    await fetch("/api/employers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employerForm),
    });
    setEmployerForm({ companyName: "", jobTitle: "", startDate: "", endDate: "", description: "" });
    setShowEmployerForm(false);
    load();
  }

  async function addExperience(employerId: string) {
    if (!expForm.title.trim()) return;
    await fetch("/api/employers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expForm, employerId, kind: "experience" }),
    });
    setExpForm({ title: "", experienceType: "project", description: "" });
    setAddingTo(null);
    load();
  }

  async function remove(id: string, kind: "employer" | "experience") {
    await fetch(`/api/employers/${id}?kind=${kind}`, { method: "DELETE" });
    load();
  }

  /**
   * Only ever show one resume's employment history at a time.
   *
   * Each analysed resume contributes its own employer records. Two tailored
   * versions of the same CV describe the same roles with different titles and
   * dates, so showing them together produced a list where every job appeared
   * twice with slightly different wording. Employers added by hand have no
   * resume attached and always show.
   */
  const visibleEmployers = useMemo(
    () => employers.filter((e) => !e.sourceResumeId || e.sourceResumeId === resumeFilter),
    [employers, resumeFilter]
  );

  const byEmployer = useMemo(() => {
    const map: Record<string, Experience[]> = {};
    for (const x of experiences) {
      const key = x.employerId ?? "unassigned";
      (map[key] ||= []).push(x);
    }
    return map;
  }, [experiences]);

  const unassigned = byEmployer["unassigned"] ?? [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Experience"
        subtitle="Your resume doesn't tell the whole story — add what's missing."
      />

      {resumes.length > 1 && (
        <Card className="p-4">
          <label className="text-sm font-medium text-navy/80">Showing experience from</label>
          <p className="text-xs text-navy/45 mt-0.5">
            Each resume brings its own employment history. Pick one to avoid seeing the same roles
            twice with different wording.
          </p>
          <select
            className="input mt-1.5"
            value={resumeFilter}
            onChange={(e) => setResumeFilter(e.target.value)}
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Employers"
          action={
            <Button variant="secondary" onClick={() => setShowEmployerForm((v) => !v)}>
              <Plus size={14} /> Add Employer
            </Button>
          }
        />

        {showEmployerForm && (
          <div className="px-5 py-4 border-b border-surface-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Company" value={employerForm.companyName}
                onChange={(e) => setEmployerForm({ ...employerForm, companyName: e.target.value })} />
              <input className="input" placeholder="Job title" value={employerForm.jobTitle}
                onChange={(e) => setEmployerForm({ ...employerForm, jobTitle: e.target.value })} />
              <input className="input" placeholder="Start (e.g. March 2019)" value={employerForm.startDate}
                onChange={(e) => setEmployerForm({ ...employerForm, startDate: e.target.value })} />
              <input className="input" placeholder="End (or Present)" value={employerForm.endDate}
                onChange={(e) => setEmployerForm({ ...employerForm, endDate: e.target.value })} />
            </div>
            <textarea className="input min-h-[70px]" placeholder="What you did there"
              value={employerForm.description}
              onChange={(e) => setEmployerForm({ ...employerForm, description: e.target.value })} />
            <div className="flex gap-2">
              <Button onClick={addEmployer} disabled={!employerForm.companyName.trim()}>Save employer</Button>
              <Button variant="secondary" onClick={() => setShowEmployerForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-surface-border">
          {visibleEmployers.map((emp) => {
            const items = byEmployer[emp.id] ?? [];
            const expanded = open[emp.id];
            return (
              <div key={emp.id}>
                <div className="flex items-start gap-2 px-5 py-3">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [emp.id]: !o[emp.id] }))}
                    className="flex flex-1 items-start gap-2 text-left"
                    aria-expanded={Boolean(expanded)}
                  >
                    {expanded ? (
                      <ChevronDown size={15} className="mt-0.5 shrink-0 text-navy/40" />
                    ) : (
                      <ChevronRight size={15} className="mt-0.5 shrink-0 text-navy/40" />
                    )}
                    <Briefcase size={15} className="mt-0.5 shrink-0 text-navy/30" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">
                        {emp.jobTitle ? `${emp.jobTitle} · ` : ""}
                        {emp.companyName}
                      </p>
                      <p className="text-xs text-navy/45">
                        {[emp.startDate, emp.endDate].filter(Boolean).join(" – ") || "Dates not set"}
                        {items.length > 0 && ` · ${items.length} experience${items.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  </button>
                  <button onClick={() => remove(emp.id, "employer")} title="Delete" className="text-brand-danger/70 hover:text-brand-danger">
                    <Trash2 size={15} />
                  </button>
                </div>

                {expanded && (
                  <div className="bg-surface-muted px-5 py-4 space-y-3">
                    {emp.description && (
                      <p className="text-sm text-navy/70 whitespace-pre-line">{emp.description}</p>
                    )}

                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((x) => (
                          <div key={x.id} className="flex items-start justify-between gap-3 rounded-lg border border-surface-border bg-surface p-3">
                            <div className="min-w-0">
                              <p className="text-sm text-navy">{x.title}</p>
                              {x.description && <p className="mt-0.5 text-xs text-navy/60">{x.description}</p>}
                              <p className="mt-0.5 text-[11px] text-navy/40">{x.experienceType}</p>
                            </div>
                            <button onClick={() => remove(x.id, "experience")} title="Delete" className="text-brand-danger/70 hover:text-brand-danger">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {addingTo === emp.id ? (
                      <div className="space-y-2 rounded-lg border border-surface-border bg-surface p-3">
                        <input className="input" placeholder="What happened? e.g. Recovered a stalled go-live"
                          value={expForm.title}
                          onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} />
                        <select className="input" value={expForm.experienceType}
                          onChange={(e) => setExpForm({ ...expForm, experienceType: e.target.value })}>
                          {EXPERIENCE_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                        <textarea className="input min-h-[70px]" placeholder="What you did and what came of it"
                          value={expForm.description}
                          onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
                        <div className="flex gap-2">
                          <Button onClick={() => addExperience(emp.id)} disabled={!expForm.title.trim()}>Save</Button>
                          <Button variant="secondary" onClick={() => setAddingTo(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="secondary" onClick={() => { setAddingTo(emp.id); setExpForm({ title: "", experienceType: "project", description: "" }); }}>
                        <Plus size={14} /> Add experience at {emp.companyName}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {visibleEmployers.length === 0 && (
            <p className="px-5 py-6 text-sm text-navy/40">
              No employers yet. Upload a resume, or add one by hand above.
            </p>
          )}
        </div>
      </Card>

      {unassigned.length > 0 && (
        <Card>
          <CardHeader title="Not tied to an employer" />
          <div className="divide-y divide-surface-border">
            {unassigned.map((x) => (
              <div key={x.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-navy">{x.title}</p>
                  {x.description && <p className="mt-0.5 text-xs text-navy/60">{x.description}</p>}
                  <p className="mt-0.5 text-[11px] text-navy/40">{x.experienceType}</p>
                </div>
                <button onClick={() => remove(x.id, "experience")} title="Delete" className="text-brand-danger/70 hover:text-brand-danger">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
