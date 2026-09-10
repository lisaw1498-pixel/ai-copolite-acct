import type { Metadata } from "next";
import "./globals.css";

// Deliberately not using next/font/google here: it fetches Inter from
// fonts.googleapis.com at build time, which fails in offline/restricted
// network environments (corporate proxies, sandboxes). We fall back to the
// closest-matching system font stack instead - see --font-inter in globals.css.

export const metadata: Metadata = {
  title: "AI Interview Copilot",
  description: "Your experience. Your answers. Real-time interview support.",
};

// Runs before the first paint, so a dark-mode user never sees a white flash on
// load. It has to be inline and synchronous for that reason - doing this in a
// React effect would paint light first, then correct itself.
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
