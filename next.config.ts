import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep the PDF stack out of the server bundle.
   *
   * pdfjs-dist loads its parser in a worker (pdf.worker.mjs). When the bundler
   * inlines the library it rewrites that import to a generated chunk path that
   * is never emitted, so every PDF upload failed with:
   *
   *   Setting up fake worker failed: "Cannot find module
   *   '.../.next/dev/server/chunks/pdf.worker.mjs'"
   *
   * Listing them here makes Next require them from node_modules at runtime, so
   * pdfjs resolves its own worker relative to its real location.
   *
   * better-sqlite3 is a native addon and must not be bundled either.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "better-sqlite3"],
};

export default nextConfig;
