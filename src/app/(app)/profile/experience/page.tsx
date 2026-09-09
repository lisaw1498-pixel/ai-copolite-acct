"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Briefcase } from "lucide-react";

type Employer = { id: string; companyName: string; jobTitle: string | null; startDate: string | null; endDate: string | null; description: string | null };
type Experience = { id: string; employerId: string | null; experienceType: string | null; title: string; description: string | null; verified: boolean | null; source: string | null };

const EXPERIENCE_TYPES = [
  "project", "accomplishment", "responsibility", "leadership", "difficult_client", "conflict",
  "process_improvement", "implementation", "metric", "budget", "team_size", "training",
  "go_live", "change_management", "customer_success", "sales", "operational",
];

export default function ExperiencePage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [showEmployerForm, setShowEmployerForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [employerForm, setEmployerForm] = useState({ companyName: "", jobTitle: "", startDate: "", endDate: "", description: "" });
  const [expForm, setExpForm] = useState({ title: "", experienceType: "project", description: "", employerId: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/employers");
    const data = await res.json();
    setEmployers(data.employers || []);
    setExperiences(data.experiences || []);
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

  async function addExperience() {
    await fetch("/api/employers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expForm, kind: "experience" }),
    });
    setExpForm({ title: "", experienceType: "project", description: "", employerId: "" });
    setShowExpForm(false);
    load();
  }

  async function remove(id: string, kind: "employer" | "experience") {
    await fetch(`/api/employers/${id}?kind=${kind}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Experience" subtitle="Your resume doesn't tell the whole story — add what's missing." />

      <Card>
        <CardHeader
          title="Employers"
          action={<Button variant="ghost" onClick={() => setShowEmployerForm((v) => !v)}><Plus size={14} /> Add Employer</Button>}
        />
        {showEmployerForm && (
          <div className="p-5 border-b border-surface-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Company" value={employerForm.companyName} onChange={(e) => setEmployerForm({ ...employerForm, companyName: e.target.value })} />
              <input className="input" placeholder="Job Title" value={employerForm.jobTitle} onChange={(e) => setEmployerForm({ ...employerForm, jobTitle: e.target.value })} />
              <input className="input" placeholder="Start Date" value={employerForm.startDate} onChange={(e) => setEmployerForm({ ...employerForm, startDate: e.target.value })} />
              <input className="input" placeholder="End Date (or Present)" value={employerForm.endDate} onChange={(e) => setEmployerForm({ ...employerForm, endDate: e.target.value })} />
            </div>
            <textarea className="input" rows={3} placeholder="Description" value={employerForm.description} onChange={(e) => setEmployerForm({ ...employerForm, description: e.target.value })} />
            <div className="flex justify-end"><Button onClick={addEmployer} disabled={!employerForm.companyName}>Save</Button></div>
          </div>
        )}
        <div className="divide-y divide-surface-border">
          {employers.length === 0 && !showEmployerForm && <p className="p-5 text-sm text-navy/50">No employers added yet.</p>}
          {employers.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <Briefcase size={16} className="text-navy/40" />
                <div>
                  <p className="text-sm font-medium text-navy">{e.jobTitle} · {e.companyName}</p>
                  <p className="text-xs text-navy/50">{e.startDate} – {e.endDate || "Present"}</p>
                </div>
              </div>
              <Button variant="ghost" onClick={() => remove(e.id, "employer")}><Trash2 size={14} className="text-brand-danger" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Additional experience"
          subtitle="Projects, accomplishments, leadership, metrics, and more"
          action={<Button variant="ghost" onClick={() => setShowExpForm((v) => !v)}><Plus size={14} /> Add Experience</Button>}
        />
        {showExpForm && (
          <div className="p-5 border-b border-surface-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Title" value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} />
              <select className="input" value={expForm.experienceType} onChange={(e) => setExpForm({ ...expForm, experienceType: e.target.value })}>
                {EXPERIENCE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <select className="input" value={expForm.employerId} onChange={(e) => setExpForm({ ...expForm, employerId: e.target.value })}>
              <option value="">No specific employer</option>
              {employers.map((e) => <option key={e.id} value={e.id}>{e.companyName}</option>)}
            </select>
            <textarea className="input" rows={3} placeholder="Describe what you did and the result" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
            <div className="flex justify-end"><Button onClick={addExperience} disabled={!expForm.title}>Save</Button></div>
          </div>
        )}
        <div className="divide-y divide-surface-border">
          {experiences.length === 0 && !showExpForm && <p className="p-5 text-sm text-navy/50">Nothing added yet.</p>}
          {experiences.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-navy">{e.title}</p>
                <p className="text-xs text-navy/50 capitalize">{e.experienceType?.replace(/_/g, " ")} · {e.source === "resume" ? "From resume" : "User added"}</p>
              </div>
              <Button variant="ghost" onClick={() => remove(e.id, "experience")}><Trash2 size={14} className="text-brand-danger" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <style jsx global>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgba(37,99,235,0.25); }
      `}</style>
    </div>
  );
}
