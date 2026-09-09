"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/badge";
import { VERIFICATION_META } from "@/lib/verification";
import { Eye, Pencil, Check, X, GitMerge, ArrowLeftRight } from "lucide-react";

type Fact = {
  id: string;
  factType: string;
  factKey: string;
  factValue: string;
  sourceType: string;
  sourceDocument: string | null;
  sourceSection: string | null;
  sourceExcerpt: string | null;
  verificationStatus: string;
  updatedAt: string;
};

const FILTERS = ["all", "verified", "transferable", "unverified", "conflicted"] as const;

export default function VerifiedExperiencePage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [viewSource, setViewSource] = useState<Fact | null>(null);
  const [editing, setEditing] = useState<Fact | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/facts");
    const data = await res.json();
    setFacts(data.facts || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      verified: facts.filter((f) => f.verificationStatus.startsWith("verified_")).length,
      needsReview: facts.filter((f) => f.verificationStatus === "conflicted").length,
      transferable: facts.filter((f) => f.verificationStatus === "transferable").length,
      unverified: facts.filter((f) => f.verificationStatus === "unverified").length,
    }),
    [facts]
  );

  const filtered = facts.filter((f) => {
    if (filter === "all") return true;
    if (filter === "verified") return f.verificationStatus.startsWith("verified_");
    return f.verificationStatus === filter;
  });

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    await fetch(`/api/facts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    await act(editing.id, "edit", { factValue: editValue });
    setEditing(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Verified Experience"
        subtitle="Review the facts your Interview Copilot is allowed to use when speaking about your background."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Verified Facts" value={counts.verified} tone="green" />
        <StatCard label="Need Review" value={counts.needsReview} tone="red" />
        <StatCard label="Transferable Skills" value={counts.transferable} tone="teal" />
        <StatCard label="Unverified Items" value={counts.unverified} tone="amber" />
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${
              filter === f ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-navy/40 border-b border-surface-border">
              <th className="px-5 py-3 font-medium">Fact</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Verification</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((f) => (
              <tr key={f.id}>
                <td className="px-5 py-3">
                  <p className="font-medium text-navy">{f.factValue}</p>
                  <p className="text-xs text-navy/40">{f.factKey}</p>
                </td>
                <td className="px-5 py-3 text-navy/60 capitalize">{f.factType.replace(/_/g, " ")}</td>
                <td className="px-5 py-3 text-navy/60 capitalize">{f.sourceType.replace(/_/g, " ")}</td>
                <td className="px-5 py-3"><VerificationBadge status={f.verificationStatus} /></td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button title="View Source" onClick={() => setViewSource(f)} className="p-1.5 rounded hover:bg-slate-100 text-navy/50">
                      <Eye size={14} />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => {
                        setEditing(f);
                        setEditValue(f.factValue);
                      }}
                      className="p-1.5 rounded hover:bg-slate-100 text-navy/50"
                    >
                      <Pencil size={14} />
                    </button>
                    {!f.verificationStatus.startsWith("verified_") && (
                      <button title="Confirm" onClick={() => act(f.id, "confirm")} className="p-1.5 rounded hover:bg-emerald-50 text-brand-success">
                        <Check size={14} />
                      </button>
                    )}
                    {f.verificationStatus !== "unverified" && (
                      <button title="Reject" onClick={() => act(f.id, "reject")} className="p-1.5 rounded hover:bg-red-50 text-brand-danger">
                        <X size={14} />
                      </button>
                    )}
                    {f.verificationStatus !== "transferable" && (
                      <button title="Mark Transferable" onClick={() => act(f.id, "mark_transferable")} className="p-1.5 rounded hover:bg-sky-50 text-sky-600">
                        <ArrowLeftRight size={14} />
                      </button>
                    )}
                    <button title="Merge with another fact" className="p-1.5 rounded hover:bg-slate-100 text-navy/30 cursor-not-allowed" disabled>
                      <GitMerge size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-navy/40">No facts in this category.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {viewSource && (
        <Modal onClose={() => setViewSource(null)} title="Source">
          <p className="text-sm text-navy/80"><strong>{viewSource.sourceDocument || viewSource.sourceType}</strong>{viewSource.sourceSection ? ` → ${viewSource.sourceSection}` : ""}</p>
          <blockquote className="mt-3 border-l-2 border-brand-blue pl-3 text-sm italic text-navy/70">
            {viewSource.sourceExcerpt || "No excerpt captured."}
          </blockquote>
          <p className="mt-4 text-xs text-navy/40">{VERIFICATION_META[viewSource.verificationStatus as keyof typeof VERIFICATION_META]?.description}</p>
        </Modal>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} title="Edit fact">
          <textarea className="w-full rounded-lg border border-surface-border p-3 text-sm" rows={3} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
          <button onClick={onClose}><X size={16} className="text-navy/40" /></button>
        </div>
        {children}
      </Card>
    </div>
  );
}
