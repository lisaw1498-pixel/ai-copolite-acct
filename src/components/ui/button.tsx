import clsx from "clsx";
import Link from "next/link";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<string, string> = {
  primary: "bg-brand-blue text-white hover:bg-brand-blue-dark px-4 py-2",
  secondary: "border border-surface-border bg-white text-navy hover:bg-slate-50 px-4 py-2",
  ghost: "text-navy/70 hover:bg-slate-100 px-3 py-1.5",
  teal: "bg-brand-teal text-white hover:bg-teal-600 px-4 py-2",
  danger: "border border-red-200 text-brand-danger hover:bg-red-50 px-4 py-2",
  subtle: "bg-slate-100 text-navy hover:bg-slate-200 px-3 py-1.5",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  href?: string;
};

export function Button({ variant = "primary", className, href, ...props }: Props) {
  const cls = clsx(base, variants[variant], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {props.children as React.ReactNode}
      </Link>
    );
  }
  return <button className={cls} {...props} />;
}
