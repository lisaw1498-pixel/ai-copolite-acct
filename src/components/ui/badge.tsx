import { VERIFICATION_META, VerificationStatus } from "@/lib/verification";
import clsx from "clsx";

export function VerificationBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = VERIFICATION_META[status as VerificationStatus] ?? {
    label: status,
    symbol: "•",
    className: "bg-surface-muted text-slate-600 border-slate-200",
    description: "",
  };
  return (
    <span
      title={meta.description}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.className,
        className
      )}
    >
      <span aria-hidden>{meta.symbol}</span>
      {meta.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "teal" | "amber" | "red" | "green";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-slate-600",
    blue: "bg-accent-soft text-blue-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
