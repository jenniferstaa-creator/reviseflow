import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory containing this config (= the ReviseFlow app root). */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Pin Turbopack’s project root to this folder so a parent `package-lock.json`
   * (e.g. under `Documents/`) does not get picked up as the monorepo root.
   */
  turbopack: {
    root: appRoot,
  },
  /** Keep pdfjs on the Node resolution path (workers + legacy build). */
  serverExternalPackages: ["pdfjs-dist"],
  /**
   * Ensure pdf.worker is present in serverless output (Vercel/AWS) when tracing.
   */
  outputFileTracingIncludes: {
    "/api/parse-pdf": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
