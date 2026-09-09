"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Plus, Sparkles, Trash2, X } from "lucide-react";

type Story = {
  id: string;
  title: string;
  category: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  metrics: string | null;
  verificationScore: number | null;
  strengthScore: number | null;
  timesUsed: number | null;
};

const CATEGORIES = [
  "Leadership", "Conflict", "Difficult Client", "Failure", "Success", "Project Recovery",
  "Process Improvement", "Innovation", "Risk Management", "Deadline", "Technical Issue",
  "Customer Success", "Change Management", "Teamwork", "Communication", "Executive Stakeholder",
  "Implementation", "Training", "Go-Live", "Operations", "Sales",
];

const empty = { title: "", category: "Leadership", situation: "", task: "", action: "", result: "", metrics: "" };

export default function CareerStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState<Story | null>(null);
  const [improving, setImproving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/career-stories");
    const data = await res.json();
    setStories(data.stories || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    await fetch("/api/career-stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(empty);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/career-stories/${id}`, { method: "DELETE" });
    setOpen(null);
    load();
  }

  async function improve(story: Story) {
    setImproving(true);
    const res = await fetch(`/api/career-stories/${story.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "improve_wording" }),
    });
    const data = await res.json();
    setImproving(false);
    if (res.ok) {
      setOpen({ ...story, ...data.improved });
      load();
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Your Interview Story Bank"
        subtitle="Build reusable STAR stories your Interview Copilot can draw on."
        action={<Button onClick={() => setShowForm(true)}><Plus size={15} /> Add Career Story</Button>}
      />

      {showForm && (
        <Card className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Story Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <textarea className="input" rows={2} placeholder="Situation — what was happening?" value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Task — what were you responsible for?" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Action — what specifically did you do?" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Result — what happened?" value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
          <input className="input" placeholder="Metrics — measurable result (optional but strengthens verification)" value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.title || !form.situation}>Save Story</Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {stories.map((s) => (
          <Card key={s.id} className="p-4 cursor-pointer hover:border-brand-blue/40" onClick={() => setOpen(s)}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-navy">{s.title}</p>
              <Pill tone={((s.verificationScore ?? 0) >= 90 ? "green" : "amber")}>{s.verificationScore ?? 0}% Verified</Pill>
            </div>
            <p className="mt-1 text-xs text-navy/50">{s.category} · Used {s.timesUsed ?? 0}x</p>
            <p className="mt-2 text-sm text-navy/70 line-clamp-2">{s.situation}</p>
          </Card>
        ))}
        {stories.length === 0 && !showForm && (
          <p className="text-sm text-navy/50">No career stories yet — add your first one above.</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setOpen(null)}>
          <Card className="max-w-xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-navy">{open.title}</h3>
              <button onClick={() => setOpen(null)}><X size={18} className="text-navy/40" /></button>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Pill tone="blue">{open.category}</Pill>
              <Pill tone={(open.verificationScore ?? 0) >= 90 ? "green" : "amber"}>{open.verificationScore ?? 0}% Verified</Pill>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-medium text-navy/70">Situation</dt><dd className="text-navy/80">{open.situation}</dd></div>
              <div><dt className="font-medium text-navy/70">Task</dt><dd className="text-navy/80">{open.task}</dd></div>
              <div><dt className="font-medium text-navy/70">Action</dt><dd className="text-navy/80">{open.action}</dd></div>
              <div><dt className="font-medium text-navy/70">Result</dt><dd className="text-navy/80">{open.result}</dd></div>
              {open.metrics && <div><dt className="font-medium text-navy/70">Metrics</dt><dd className="text-navy/80">{open.metrics}</dd></div>}
            </dl>
            <div className="mt-6 flex justify-between">
              <Button variant="danger" onClick={() => remove(open.id)}><Trash2 size={14} /> Delete</Button>
              <Button variant="secondary" onClick={() => improve(open)} disabled={improving}>
                <Sparkles size={14} /> {improving ? "Improving..." : "Improve My STAR Story"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <style jsx global>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgba(37,99,235,0.25); }
      `}</style>
    </div>
  );
}
