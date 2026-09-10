"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";

export type Theme = "light" | "dark";

/** Reads the theme the way the pre-paint script in the layout does. */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private mode - the choice just won't survive a reload.
  }
}

/**
 * Light/dark switch.
 *
 * The choice is written to localStorage immediately so it applies before the
 * next paint, and saved to the account in the background so it follows the
 * user to another machine. localStorage is the source of truth for rendering;
 * the server copy is only a convenience.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    void fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // Saving the preference is not worth interrupting anything for.
    });
  }

  const label = theme === "dark" ? "Switch to light" : "Switch to dark";

  if (compact) {
    return (
      <button onClick={toggle} title={label} aria-label={label} className="text-white/70 hover:text-white">
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
        "text-navy/70 hover:bg-surface-muted"
      )}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
