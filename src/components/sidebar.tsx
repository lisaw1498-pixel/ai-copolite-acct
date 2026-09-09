"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  User,
  Briefcase,
  NotebookPen,
  Mic,
  Radio,
  History,
  Settings,
  FileText,
  BookOpen,
  Wrench,
  ShieldCheck,
  ListChecks,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { label: string; icon: React.ElementType; items: NavItem[] } | NavItem;

const NAV: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "My Profile",
    icon: User,
    items: [
      { label: "Resume", href: "/profile/resume", icon: FileText },
      { label: "Experience", href: "/profile/experience", icon: Briefcase },
      { label: "Career Stories", href: "/profile/career-stories", icon: BookOpen },
      { label: "Skills & Tools", href: "/profile/skills", icon: Wrench },
      { label: "Verified Experience", href: "/profile/verified-experience", icon: ShieldCheck },
    ],
  },
  {
    label: "Jobs",
    icon: Briefcase,
    items: [
      { label: "Job Opportunities", href: "/jobs", icon: Briefcase },
      { label: "Job Analysis", href: "/jobs?focus=analysis", icon: ListChecks },
    ],
  },
  {
    label: "Prepare",
    icon: NotebookPen,
    items: [
      { label: "Interview Prep", href: "/prepare", icon: NotebookPen },
      { label: "Question Library", href: "/prepare/questions", icon: ClipboardList },
      { label: "Answer Library", href: "/prepare/answers", icon: FileText },
    ],
  },
  {
    label: "Practice",
    icon: Mic,
    items: [{ label: "Mock Interview", href: "/practice", icon: Mic }],
  },
  {
    label: "Live",
    icon: Radio,
    items: [{ label: "Live Interview Copilot", href: "/live", icon: Radio }],
  },
  { label: "History", href: "/history", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isGroup(item: NavGroup): item is Extract<NavGroup, { items: NavItem[] }> {
  return "items" in item;
}

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  // The live copilot owns the whole screen. The blueprint is explicit that
  // nothing - "Large Navigation" included - may compete with the interviewer's
  // question, SAY THIS, and REMEMBER THIS while an interview is running.
  if (pathname.startsWith("/live/session/")) return null;

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-surface-border bg-white h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-surface-border">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white text-sm font-bold">
          AI
        </span>
        <span className="text-sm font-semibold text-navy">Interview Copilot</span>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
        {NAV.map((entry) => {
          if (!isGroup(entry)) {
            const Icon = entry.icon;
            const active = pathname === entry.href;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-blue-50 text-brand-blue" : "text-navy/70 hover:bg-slate-50"
                )}
              >
                <Icon size={16} />
                {entry.label}
              </Link>
            );
          }
          const GroupIcon = entry.icon;
          return (
            <div key={entry.label}>
              <div className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-navy/40">
                <GroupIcon size={13} />
                {entry.label}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {entry.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href.split("?")[0]);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-lg px-3 py-1.5 ml-1 text-sm",
                        active
                          ? "bg-blue-50 text-brand-blue font-medium"
                          : "text-navy/60 hover:bg-slate-50"
                      )}
                    >
                      <Icon size={14} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-surface-border p-3">
        <div className="flex items-center justify-between rounded-lg px-2 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-navy shrink-0">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate text-sm text-navy/80">{userName}</span>
          </div>
          <button
            title="Sign out"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-navy/40 hover:text-navy"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
