import { NextResponse, type NextRequest } from "next/server";
import { extractPdfText } from "@/lib/extract-pdf-text";

export const runtime = "nodejs";

const STAGE = "pdf_parse" as const;

function logParse(
  level: "error" | "warn",
  msg: string,
  extra?: Record<string, unknown>
) {
  const line = { stage: STAGE, msg, ...extra };
  if (level === "error") {
    console.error("[reviseflow:parse-pdf]", line);
  } else {
    console.warn("[reviseflow:parse-pdf]", line);
  }
}

function json(
  body: Record<string, unknown>,
  status: number,
  logMsg?: string,
  logExtra?: Record<string, unknown>
) {
  if (logMsg) {
    if (status >= 500) logParse("error", logMsg, logExtra);
    else if (status >= 400) logParse("warn", logMsg, logExtra);
  }
  return NextResponse.json({ ...body, stage: STAGE }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return json(
        {
          ok: false,
          error: "Missing PDF file in form field `file`.",
        },
        400,
        "missing_file_field"
      );
    }

    const blob = file as File;
    const type = blob.type || "";
    if (
      type &&
      type !== "application/pdf" &&
      !type.includes("pdf") &&
      type !== "application/octet-stream"
    ) {
      return json(
        {
          ok: false,
          error: `Expected a PDF file; got “${type}”.`,
        },
        415,
        "unexpected_mime",
        { mime: type }
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length === 0) {
      return json({ ok: false, error: "Empty file." }, 400, "empty_buffer");
    }

    let extracted: { text: string; numPages: number; engine: string };
    try {
      extracted = await extractPdfText(buffer);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error
          ? parseErr.message
          : "PDF text extraction failed.";
      const stack = parseErr instanceof Error ? parseErr.stack : undefined;
      logParse("error", "extract_failed", {
        message,
        stack,
        bufferBytes: buffer.length,
        hint:
          "pdf.js text extraction threw. If you see canvas or worker errors, ensure dependencies are installed in reviseflow/ and restart the dev server.",
      });
      return json(
        {
          ok: false,
          error: message,
          detail:
            "PDF parsing failed (stage: pdf_parse). This route uses pdfjs-dist text-only mode—no @napi-rs/canvas. See terminal log [reviseflow:parse-pdf].",
        },
        422,
        "extract_caught"
      );
    }

    const text = extracted.text.trim();
    const numPages =
      typeof extracted.numPages === "number" && extracted.numPages > 0
        ? extracted.numPages
        : null;

    console.info("[reviseflow:parse-pdf]", {
      stage: STAGE,
      msg: "ok",
      engine: extracted.engine,
      numPages,
      textLength: text.length,
      bufferBytes: buffer.length,
    });

    return NextResponse.json({
      ok: true,
      stage: STAGE,
      text,
      numPages,
      textLength: text.length,
      engine: extracted.engine,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "PDF route failed unexpectedly.";
    const stack = e instanceof Error ? e.stack : undefined;
    logParse("error", "unhandled_route_error", { message, stack });
    return json(
      {
        ok: false,
        error: message,
        detail:
          "Unhandled error in /api/parse-pdf. See terminal [reviseflow:parse-pdf] unhandled_route_error.",
      },
      500,
      "fatal"
    );
  }
}
