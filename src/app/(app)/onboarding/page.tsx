"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, Loader2, CheckCircle2 } from "lucide-react";

const STEPS = ["About you", "Upload resume", "Experience library", "Add a job", "Match analysis"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [about, setAbout] = useState({
    fullName: "",
    currentTitle: "",
    targetTitle: "",
    yearsExperience: "",
    industry: "",
    linkedinUrl: "",
  });

  const [resumeStatus, setResumeStatus] = useState<"idle" | "uploading" | "analyzed" | "error">("idle");
  const [resumeError, setResumeError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [jobForm, setJobForm] = useState({ company: "", jobTitle: "", jobDescriptionRaw: "" });
  const [jobResult, setJobResult] = useState<{ id: string; matchScore: number | null } | null>(null);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  async function saveAbout() {
    setSaving(true);
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(about),
    });
    setSaving(false);
    setStep(1);
  }

  async function uploadResume(file: File) {
    setResumeStatus("uploading");
    setResumeError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/resumes", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setResumeError(data.error || "Upload failed.");
      setResumeStatus("error");
      return;
    }
    setResumeStatus("analyzed");
  }

  async function submitJob() {
    setJobSaving(true);
    setJobError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobForm),
    });
    const data = await res.json();
    setJobSaving(false);
    if (!res.ok) {
      setJobError(data.error || "Couldn't analyze that job.");
      return;
    }
    setJobResult({ id: data.job.id, matchScore: data.job.matchScore });
    setStep(4);
  }

  async function finish() {
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true }),
    });
    router.push(jobResult ? `/prepare/${jobResult.id}` : "/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-blue" : "bg-surface-border"}`} />
            <p className={`mt-1.5 text-[11px] ${i === step ? "text-brand-blue font-medium" : "text-navy/40"}`}>{label}</p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy">Tell us about you</h2>
          <div className="mt-5 space-y-4">
            <Field label="Full Name">
              <input className="input" value={about.fullName} onChange={(e) => setAbout({ ...about, fullName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Current Job Title">
                <input className="input" value={about.currentTitle} onChange={(e) => setAbout({ ...about, currentTitle: e.target.value })} />
              </Field>
              <Field label="Target Job Title">
                <input className="input" value={about.targetTitle} onChange={(e) => setAbout({ ...about, targetTitle: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Years of Experience">
                <input className="input" value={about.yearsExperience} onChange={(e) => setAbout({ ...about, yearsExperience: e.target.value })} />
              </Field>
              <Field label="Primary Industry">
                <input className="input" value={about.industry} onChange={(e) => setAbout({ ...about, industry: e.target.value })} />
              </Field>
            </div>
            <Field label="LinkedIn URL (optional)">
              <input className="input" value={about.linkedinUrl} onChange={(e) => setAbout({ ...about, linkedinUrl: e.target.value })} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={saveAbout} disabled={saving}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold text-navy">Upload Your Resume</h2>
          <p className="mt-1 text-sm text-navy/60">
            We&apos;ll turn your resume into a structured professional knowledge base your Interview Copilot can use.
          </p>
          <div
            className="mt-6 border-2 border-dashed border-surface-border rounded-xl p-8 cursor-pointer hover:border-brand-blue/50"
            onClick={() => fileInput.current?.click()}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadResume(f);
              }}
            />
            {resumeStatus === "uploading" && (
              <p className="flex items-center justify-center gap-2 text-sm text-navy/60">
                <Loader2 className="animate-spin" size={16} /> Analyzing...
              </p>
            )}
            {resumeStatus === "analyzed" && (
              <p className="flex items-center justify-center gap-2 text-sm text-brand-success font-medium">
                <CheckCircle2 size={16} /> Resume Successfully Analyzed
              </p>
            )}
            {resumeStatus === "idle" && (
              <>
                <UploadCloud className="mx-auto text-brand-blue" size={26} />
                <p className="mt-2 text-sm text-navy">Browse Files (PDF, DOCX, TXT)</p>
              </>
            )}
            {resumeStatus === "error" && <p className="text-sm text-brand-danger">{resumeError}</p>}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Skip for now</Button>
            <Button onClick={() => setStep(2)} disabled={resumeStatus === "uploading"}>
              {resumeStatus === "analyzed" ? "Review My Profile → Continue" : "Continue"}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy">Your Resume Doesn&apos;t Tell the Whole Story</h2>
          <p className="mt-1 text-sm text-navy/60">
            You can add projects, leadership examples, metrics, and more any time from My Profile → Experience and
            Career Stories. Let&apos;s keep moving for now — you can fill this in later.
          </p>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>I&apos;ll Do This Later</Button>
            <Button href="/profile/experience">Add Experience</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-navy">Add Your First Job Opportunity</h2>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company">
                <input className="input" value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} />
              </Field>
              <Field label="Job Title">
                <input className="input" value={jobForm.jobTitle} onChange={(e) => setJobForm({ ...jobForm, jobTitle: e.target.value })} />
              </Field>
            </div>
            <Field label="Paste Job Description">
              <textarea
                rows={8}
                className="input"
                value={jobForm.jobDescriptionRaw}
                onChange={(e) => setJobForm({ ...jobForm, jobDescriptionRaw: e.target.value })}
              />
            </Field>
          </div>
          {jobError && <p className="mt-3 text-sm text-brand-danger">{jobError}</p>}
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={finish}>Skip for now</Button>
            <Button onClick={submitJob} disabled={jobSaving || !jobForm.jobDescriptionRaw.trim()}>
              {jobSaving ? "Analyzing..." : "Analyze This Job"}
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold text-navy">Job Match Analysis</h2>
          <p className="mt-4 text-5xl font-semibold text-brand-blue">{jobResult?.matchScore ?? "—"}%</p>
          <p className="text-sm text-navy/50 mt-1">Overall Match</p>
          <div className="mt-8 flex justify-center">
            <Button onClick={finish}>Prepare for This Interview</Button>
          </div>
        </Card>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-navy/80 mb-1">{label}</span>
      {children}
    </label>
  );
}
