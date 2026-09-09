export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-navy/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
