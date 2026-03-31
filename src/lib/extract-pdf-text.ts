/**
 * Text-only PDF extraction for Node (API routes). Uses pdf.js getTextContent —
 * no rendering, no @napi-rs/canvas, no node-canvas.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function resolvePdfWorkerUrl(): string {
  const workerName = "pdf.worker.mjs";
  const roots = [
    process.cwd(),
    // Fallback if cwd is not the app root (unusual in Next; harmless to try)
    path.join(process.cwd(), "reviseflow"),
  ];

  for (const root of roots) {
    const p = path.join(
      root,
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      workerName
    );
    if (fs.existsSync(p)) {
      return pathToFileURL(p).href;
    }
  }

  throw new Error(
    "pdfjs-dist worker not found. Run `npm install` in the reviseflow directory (same folder as package.json), not only the parent Documents folder."
  );
}

export type ExtractPdfTextResult = {
  text: string;
  numPages: number;
  engine: "pdfjs-dist";
};

export async function extractPdfText(buffer: Buffer): Promise<ExtractPdfTextResult> {
  const { getDocument, GlobalWorkerOptions } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  GlobalWorkerOptions.workerSrc = resolvePdfWorkerUrl();

  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  const parts: string[] = [];

  try {
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const line: string[] = [];
      for (const item of textContent.items) {
        if (item && typeof item === "object" && "str" in item) {
          const s = (item as { str: string }).str;
          if (s) line.push(s);
        }
      }
      parts.push(line.join(" "));
    }
  } finally {
    await doc.destroy().catch(() => {
      /* ignore */
    });
  }

  const text = parts.join("\n\n").replace(/\s+\n/g, "\n").trim();

  return { text, numPages, engine: "pdfjs-dist" };
}
