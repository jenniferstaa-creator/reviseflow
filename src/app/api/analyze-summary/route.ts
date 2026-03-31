import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type { CourseSummary } from "@/data/types";
import { titleFromFileName } from "@/lib/generate-from-text";
import { MAX_SUMMARY_INPUT_CHARS } from "@/lib/summary-api";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Shape returned by the model (JSON). */
type AiSummaryJson = {
  overview: string;
  keyConcepts: string[];
  likelyExamTopics: string[];
  confusingPoints: Array<{ title: string; note: string }>;
  simplifiedExplanation: Array<{ term: string; explanation: string }>;
};

function isAiSummaryJson(data: unknown): data is AiSummaryJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.overview !== "string") return false;
  if (
    !Array.isArray(o.keyConcepts) ||
    !o.keyConcepts.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (
    !Array.isArray(o.likelyExamTopics) ||
    !o.likelyExamTopics.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (!Array.isArray(o.confusingPoints)) return false;
  for (const cp of o.confusingPoints) {
    if (
      !cp ||
      typeof cp !== "object" ||
      typeof (cp as { title?: unknown }).title !== "string" ||
      typeof (cp as { note?: unknown }).note !== "string"
    ) {
      return false;
    }
  }
  if (!Array.isArray(o.simplifiedExplanation)) return false;
  for (const se of o.simplifiedExplanation) {
    if (
      !se ||
      typeof se !== "object" ||
      typeof (se as { term?: unknown }).term !== "string" ||
      typeof (se as { explanation?: unknown }).explanation !== "string"
    ) {
      return false;
    }
  }
  return true;
}

function mapToCourseSummary(
  data: AiSummaryJson,
  documentTitle: string
): CourseSummary {
  return {
    courseTitle: titleFromFileName(documentTitle),
    chapterOverview: data.overview.trim(),
    keyConcepts: data.keyConcepts.map((s) => s.trim()).filter(Boolean),
    likelyExamTopics: data.likelyExamTopics.map((s) => s.trim()).filter(Boolean),
    confusingPoints: data.confusingPoints
      .map((cp) => ({
        title: cp.title.trim(),
        note: cp.note.trim(),
      }))
      .filter((cp) => cp.title && cp.note),
    simplifiedExplanations: data.simplifiedExplanation
      .map((x) => ({
        term: x.term.trim(),
        explanation: x.explanation.trim(),
      }))
      .filter((x) => x.term && x.explanation),
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  let body: {
    text?: string;
    documentTitle?: string;
    pageCount?: number | null;
    textWasClipped?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText.length) {
    return NextResponse.json(
      { ok: false, error: "No text provided for analysis." },
      { status: 400 }
    );
  }

  const documentTitle =
    typeof body.documentTitle === "string" && body.documentTitle.trim()
      ? body.documentTitle.trim()
      : "document.pdf";

  const clipped =
    rawText.length > MAX_SUMMARY_INPUT_CHARS || Boolean(body.textWasClipped);
  const textForModel = rawText.slice(0, MAX_SUMMARY_INPUT_CHARS);

  const system = `You are an expert study coach for university students.
You receive plain text extracted from ONE PDF the student uploaded.
Every field you output must be grounded ONLY in that text—no outside facts, no generic course templates.
If the extract is short, sparse, or messy, still produce the JSON and clearly state limitations in the overview or confusingPoints where appropriate.
Return ONLY a single JSON object with these exact keys (no markdown fences):
- overview: string (2–6 paragraphs, plain text, cohesive summary of this document only)
- keyConcepts: string[] (4–8 bullet-worthy lines; each one clear and specific to this text)
- likelyExamTopics: string[] (4–8 items; plausible exam prompts a professor might ask based ONLY on this material)
- confusingPoints: array of objects { "title": string, "note": string } (2–5 pairs where students often stumble, tied to this text)
- simplifiedExplanation: array of objects { "term": string, "explanation": string } (3–6 key terms or ideas from the text explained simply)`;

  const userPrefix =
    clipped || textForModel.length < rawText.length
      ? `NOTE: The extract may be truncated to the first ${MAX_SUMMARY_INPUT_CHARS.toLocaleString()} characters for processing.\n\n---\n\n`
      : "";

  const userMessage = `${userPrefix}DOCUMENT FILENAME (for context only, do not invent a different course name): ${documentTitle}\n\nEXTRACTED TEXT:\n\n${textForModel}`;

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Empty response from model." },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Model did not return valid JSON." },
        { status: 502 }
      );
    }

    if (!isAiSummaryJson(parsed)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Model JSON did not match the expected summary schema.",
        },
        { status: 502 }
      );
    }

    const summary = mapToCourseSummary(parsed, documentTitle);

    if (
      !summary.chapterOverview.length ||
      summary.keyConcepts.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Model returned an unusable summary (missing overview or concepts).",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      summary,
      meta: {
        inputChars: textForModel.length,
        clipped,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "OpenAI request failed unexpectedly.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
