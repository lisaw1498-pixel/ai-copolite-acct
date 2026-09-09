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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
