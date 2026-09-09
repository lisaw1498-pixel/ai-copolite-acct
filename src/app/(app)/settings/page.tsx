"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

type Settings = {
  saveTranscripts: boolean;
  saveAudio: boolean;
  autoDeleteAfter: string;
  quickGlanceEnabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setAiConfigured(d.aiConfigured);
      });
  }, []);

  async function update(patch: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Settings" subtitle="AI configuration and privacy controls." />

      <Card>
        <CardHeader title="AI configuration" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {aiConfigured ? (
              <Pill tone="green"><CheckCircle2 size={11} className="inline mr-1" />Anthropic API key configured</Pill>
            ) : (
              <Pill tone="red"><XCircle size={11} className="inline mr-1" />No Anthropic API key configured</Pill>
            )}
          </div>
          <p className="text-xs text-navy/50">
            AI features (resume parsing, job matching, question and answer generation, mock and live interviews) run
            on Anthropic&apos;s Claude models. Add your key to <code className="bg-slate-100 px-1 rounded">.env.local</code>{" "}
            as <code className="bg-slate-100 px-1 rounded">ANTHROPIC_API_KEY</code> and restart the server — for
            security, keys are never exposed to the browser and can&apos;t be set from this page.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Privacy controls" />
        <div className="p-5 space-y-4">
          <Toggle
            label="Save Transcripts"
            checked={settings?.saveTranscripts ?? true}
            onChange={(v) => update({ saveTranscripts: v })}
          />
          <Toggle
            label="Save Audio"
            checked={settings?.saveAudio ?? false}
            onChange={(v) => update({ saveAudio: v })}
          />
          <div>
            <label className="text-sm font-medium text-navy/80">Auto-delete transcripts after</label>
            <select
              className="mt-1 rounded-lg border border-surface-border px-3 py-1.5 text-sm"
              value={settings?.autoDeleteAfter ?? "never"}
              onChange={(e) => update({ autoDeleteAfter: e.target.value })}
            >
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="never">Never</option>
            </select>
          </div>
          <Toggle
            label="Enable Quick Glance Mode by default"
            checked={settings?.quickGlanceEnabled ?? true}
            onChange={(v) => update({ quickGlanceEnabled: v })}
          />
        </div>
      </Card>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm text-navy/80">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
