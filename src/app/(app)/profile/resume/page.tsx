"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { UploadCloud, FileText, Star, Trash2, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

type Resume = {
  id: string;
  name: string;
  fileName: string | null;
  isDefault: boolean;
  status: "processing" | "analyzed" | "failed";
  createdAt: string;
  updatedAt: string;
};

export default function ResumeManagerPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/resumes");
    const data = await res.json();
    setResumes(data.resumes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(file?: File, text?: string) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    if (file) form.append("file", file);
    if (text) form.append("text", text);
    const res = await fetch("/api/resumes", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed.");
      await load();
      return;
    }
    setPastedText("");
    setShowPaste(false);
    await load();
  }

  async function act(id: string, action: string) {
    await fetch(`/api/resumes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="My Resumes"
        subtitle="Upload your resume so your Interview Copilot can build a verified knowledge base from it."
      />

      <Card
        className="p-8 text-center border-dashed border-2 cursor-pointer hover:border-brand-blue/50"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e: React.DragEvent) => e.preventDefault()}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <UploadCloud className="mx-auto text-brand-blue" size={28} />
        <p className="mt-3 text-sm font-medium text-navy">
          Drag & drop your resume, or click to browse
        </p>
        <p className="mt-1 text-xs text-navy/50">PDF, DOCX, or TXT</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setShowPaste((v) => !v);
            }}
          >
            Paste Resume Instead
          </Button>
        </div>
      </Card>

      {showPaste && (
        <Card className="p-4">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            rows={8}
            placeholder="Paste your resume text here..."
            className="w-full rounded-lg border border-surface-border p-3 text-sm outline-none focus:ring-2 focus:ring-brand-blue/40"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => upload(undefined, pastedText)} disabled={!pastedText.trim()}>
              Analyze This Resume
            </Button>
          </div>
        </Card>
      )}

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-navy/60">
          <Loader2 className="animate-spin" size={16} /> Analyzing your resume with AI — extracting
          employers, skills, metrics, and accomplishments...
        </div>
      )}
      {error && (
        <p className="text-sm text-brand-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}{" "}
          {error.includes("ANTHROPIC_API_KEY") && (
            <Link href="/settings" className="underline font-medium">
              Go to Settings
            </Link>
          )}
        </p>
      )}

      <Card>
        <CardHeader title="Your resumes" subtitle={`${resumes.length} uploaded`} />
        <div className="divide-y divide-surface-border">
          {loading && <p className="p-5 text-sm text-navy/50">Loading...</p>}
          {!loading && resumes.length === 0 && (
            <p className="p-5 text-sm text-navy/50">No resumes yet — upload one above to get started.</p>
          )}
          {resumes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-navy/40 shrink-0" size={18} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-navy truncate">{r.name}</p>
                    {r.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-blue">
                        <Star size={12} fill="currentColor" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-navy/50 mt-0.5">
                    {r.status === "analyzed" && (
                      <span className="inline-flex items-center gap-1 text-brand-success">
                        <CheckCircle2 size={12} /> Resume Successfully Analyzed
                      </span>
                    )}
                    {r.status === "processing" && "Processing..."}
                    {r.status === "failed" && (
                      <span className="text-brand-danger">Analysis failed — retry below</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.status === "analyzed" && (
                  <Button variant="ghost" href="/profile/experience">
                    Review My Profile
                  </Button>
                )}
                {r.status === "failed" && (
                  <Button variant="ghost" onClick={() => act(r.id, "reanalyze")}>
                    <RefreshCw size={14} /> Retry
                  </Button>
                )}
                {!r.isDefault && (
                  <Button variant="ghost" onClick={() => act(r.id, "set_default")}>
                    Set as Default
                  </Button>
                )}
                <Button variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 size={14} className="text-brand-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
