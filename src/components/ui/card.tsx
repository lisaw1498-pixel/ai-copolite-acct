import clsx from "clsx";

export function Card({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-surface-border bg-surface shadow-sm",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-navy">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-navy/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "blue" | "teal" | "amber" | "red" | "green";
}) {
  const tones: Record<string, string> = {
    neutral: "text-navy",
    blue: "text-brand-blue",
    teal: "text-brand-teal",
    amber: "text-brand-warning",
    red: "text-brand-danger",
    green: "text-brand-success",
  };
  return (
    <Card className="px-5 py-4">
      <p className={clsx("text-2xl font-semibold", tones[tone])}>{value}</p>
      <p className="mt-1 text-xs font-medium text-navy/50">{label}</p>
    </Card>
  );
}
