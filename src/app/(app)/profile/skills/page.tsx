"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

type Skill = { id: string; skillName: string; category: string | null; yearsExperience: number | null; proficiency: string | null };
type Tech = { id: string; technologyName: string; category: string | null; experienceLevel: string | null; verificationStatus: string };

const CATEGORIES = ["Project Management", "CRM", "EHR / EMR", "Cloud", "Analytics", "Programming", "Customer Success", "Sales", "Communication", "Healthcare", "Finance", "Operations", "Leadership", "Other"];
const LEVELS = ["expert", "advanced", "intermediate", "working_knowledge", "exposure", "transferable", "no_direct_experience"];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [technologies, setTechnologies] = useState<Tech[]>([]);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showTechForm, setShowTechForm] = useState(false);
  const [skillForm, setSkillForm] = useState({ name: "", category: CATEGORIES[0], yearsExperience: "", proficiency: "intermediate" });
  const [techForm, setTechForm] = useState({ name: "", category: CATEGORIES[0], experienceLevel: "working_knowledge", example: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/skills");
    const data = await res.json();
    setSkills(data.skills || []);
    setTechnologies(data.technologies || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSkill() {
    await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillForm),
    });
    setSkillForm({ name: "", category: CATEGORIES[0], yearsExperience: "", proficiency: "intermediate" });
    setShowSkillForm(false);
    load();
  }

  async function addTech() {
    await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...techForm, kind: "technology" }),
    });
    setTechForm({ name: "", category: CATEGORIES[0], experienceLevel: "working_knowledge", example: "" });
    setShowTechForm(false);
    load();
  }

  async function updateLevel(id: string, kind: "technology" | "skill", experienceLevel: string) {
    await fetch(`/api/skills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, experienceLevel }),
    });
    load();
  }

  async function remove(id: string, kind: "technology" | "skill") {
    await fetch(`/api/skills/${id}?kind=${kind}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Skills & Tools" subtitle="Your library of skills, software, and platforms." />

      <Card>
        <CardHeader title="Technologies & platforms" action={<Button variant="ghost" onClick={() => setShowTechForm((v) => !v)}><Plus size={14}/> Add</Button>} />
        {showTechForm && (
          <div className="p-5 border-b border-surface-border space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Technology name" value={techForm.name} onChange={(e) => setTechForm({ ...techForm, name: e.target.value })} />
              <select className="input" value={techForm.category} onChange={(e) => setTechForm({ ...techForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select className="input" value={techForm.experienceLevel} onChange={(e) => setTechForm({ ...techForm, experienceLevel: e.target.value })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <input className="input" placeholder="Where used / example (optional)" value={techForm.example} onChange={(e) => setTechForm({ ...techForm, example: e.target.value })} />
            <div className="flex justify-end"><Button onClick={addTech} disabled={!techForm.name}>Save</Button></div>
          </div>
        )}
        <div className="divide-y divide-surface-border">
          {technologies.length === 0 && !showTechForm && <p className="p-5 text-sm text-navy/50">No technologies added yet.</p>}
          {technologies.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-3">
              <div>
                <p className="text-sm font-medium text-navy">{t.technologyName}</p>
                <p className="text-xs text-navy/50">{t.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="text-xs rounded-md border border-surface-border px-2 py-1"
                  value={t.experienceLevel ?? "working_knowledge"}
                  onChange={(e) => updateLevel(t.id, "technology", e.target.value)}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{l.replace(/_/g, " ")}</option>)}
                </select>
                <VerificationBadge status={t.verificationStatus} />
                <Button variant="ghost" onClick={() => remove(t.id, "technology")}><Trash2 size={14} className="text-brand-danger" /></Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Skills" action={<Button variant="ghost" onClick={() => setShowSkillForm((v) => !v)}><Plus size={14}/> Add</Button>} />
        {showSkillForm && (
          <div className="p-5 border-b border-surface-border space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Skill name" value={skillForm.name} onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })} />
              <select className="input" value={skillForm.category} onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input className="input" placeholder="Years experience" value={skillForm.yearsExperience} onChange={(e) => setSkillForm({ ...skillForm, yearsExperience: e.target.value })} />
            </div>
            <div className="flex justify-end"><Button onClick={addSkill} disabled={!skillForm.name}>Save</Button></div>
          </div>
        )}
        <div className="divide-y divide-surface-border">
          {skills.length === 0 && !showSkillForm && <p className="p-5 text-sm text-navy/50">No skills added yet.</p>}
          {skills.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-navy">{s.skillName}</p>
                <p className="text-xs text-navy/50">{s.category}{s.yearsExperience ? ` · ${s.yearsExperience} yrs` : ""}</p>
              </div>
              <Button variant="ghost" onClick={() => remove(s.id, "skill")}><Trash2 size={14} className="text-brand-danger" /></Button>
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
