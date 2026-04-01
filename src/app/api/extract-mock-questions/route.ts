import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import {
  heuristicExtractQuestionTexts,
  MAX_MOCK_EXTRACT_INPUT_CHARS,
} from "@/lib/mock-practice-extract";
import {
  classifyPracticeQuestion,
  normalizeAiQuestionShape,
} from "@/lib/practice-question-classify";
import type { PracticeQuestionType } from "@/data/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "mock_extract_questions" as const;

function logError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:extract-mock-questions]", context, {
    stage: STAGE,
    ...extra,
    message,
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

type ExtractedMockQuestion = {
  questionType: PracticeQuestionType;
  prompt: string;
  options: string[];
  correctAnswer: null;
  marks: number | null;
  source: string;
};

type AiQuestionRow = {
  text: string;
  questionType?: string;
  options?: string[];
  marks?: number | string;
};

function parseMarks(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 500) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw === "string") {
    const t = raw
      .trim()
      .replace(/\s*(p|poäng|pts?)\s*$/i, "")
      .replace(/,/g, ".");
    const n = parseFloat(t);
    if (Number.isFinite(n) && n > 0 && n <= 500) {
      return Math.round(n * 100) / 100;
    }
  }
  return null;
}

type AiQuestionsJson = { questions: AiQuestionRow[] };

function isAiQuestionsJson(data: unknown): data is AiQuestionsJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.questions)) return false;
  return o.questions.every((q) => {
    if (!q || typeof q !== "object") return false;
    const row = q as Record<string, unknown>;
    if (typeof row.text !== "string") return false;
    if (row.questionType != null && typeof row.questionType !== "string") {
      return false;
    }
    if (
      row.options != null &&
      (!Array.isArray(row.options) ||
        !row.options.every((x) => typeof x === "string"))
    ) {
      return false;
    }
    if (
      row.marks != null &&
      typeof row.marks !== "number" &&
      typeof row.marks !== "string"
    ) {
      return false;
    }
    return true;
  });
}

function finalizeQuestion(
  text: string,
  fileSource: string,
  hint?: { questionType?: string; options?: string[]; marks?: unknown }
): ExtractedMockQuestion {
  const trimmed = text.trim();
  const marks = parseMarks(hint?.marks);
  if (hint?.questionType) {
    const n = normalizeAiQuestionShape({
      prompt: trimmed,
      questionType: hint.questionType,
      options: hint.options,
    });
    return {
      questionType: n.questionType,
      prompt: n.prompt,
      options: n.options,
      correctAnswer: null,
      marks,
      source: fileSource,
    };
  }
  const c = classifyPracticeQuestion(trimmed);
  return {
    questionType: c.questionType,
    prompt: c.prompt,
    options: c.options,
    correctAnswer: null,
    marks,
    source: fileSource,
  };
}

function finalizeList(
  rows: Array<
    | string
    | {
        text: string;
        questionType?: string;
        options?: string[];
        marks?: unknown;
      }
  >,
  fileSource: string
): ExtractedMockQuestion[] {
  return rows
    .map((row) => {
      if (typeof row === "string") {
        return finalizeQuestion(row, fileSource);
      }
      return finalizeQuestion(row.text, fileSource, {
        questionType: row.questionType,
        options: row.options,
        marks: row.marks,
      });
    })
    .filter((q) => q.prompt.length >= 8);
}

export async function POST(req: NextRequest) {
  let body: { text?: string; documentTitle?: string };
  try {
    body = await req.json();
  } catch (e) {
    logError("request_json", e);
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText.length) {
    return json({ ok: false, error: "No text provided." }, 400);
  }

  const documentTitle =
    typeof body.documentTitle === "string" && body.documentTitle.trim()
      ? body.documentTitle.trim()
      : "past-paper.pdf";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const textForModel = rawText.slice(0, MAX_MOCK_EXTRACT_INPUT_CHARS);
  const clipped = rawText.length > textForModel.length;

  if (!apiKey) {
    const heuristic = heuristicExtractQuestionTexts(rawText);
    return json({
      ok: true,
      questions: finalizeList(heuristic, documentTitle),
      source: "heuristic",
      meta: { reason: "OPENAI_API_KEY missing", clipped },
    });
  }

  const system = `You split exam papers and past papers into separate questions.
Return ONLY valid JSON: { "questions": [ { "text": "...", "questionType"?: "...", "options"?: string[], "marks"?: number }, ... ] }
Rules for each item:
- "text": the FULL question as in the document (stem plus listed alternatives if any). Preserve wording; do not answer or paraphrase.
- Optional "questionType": one of "true_false", "multiple_choice", "short_answer", "essay" when obvious from the paper (e.g. True/False, select-one MCQ, written).
- Optional "options": for multiple_choice only, the answer choice texts in order (no letter prefixes). Omit for true_false.
- Optional "marks": number when the paper states points for that item (e.g. "(2p)"); omit if unclear.
- If unsure, omit questionType and options; the system will classify from "text".
- One question per item; merge sub-parts that belong together.
- Omit cover pages and boilerplate without numbered questions.
- Aim for 1–40 questions.`;

  const userMsg = `${clipped ? `NOTE: Text may be truncated to first ${MAX_MOCK_EXTRACT_INPUT_CHARS.toLocaleString()} characters.\n\n` : ""}FILENAME (context only): ${documentTitle}

EXTRACTED TEXT:

${textForModel}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MOCK_EXTRACT_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      logError("model", "empty completion");
      const fallback = heuristicExtractQuestionTexts(rawText);
      return json({
        ok: true,
        questions: finalizeList(fallback, documentTitle),
        source: "heuristic",
        meta: { reason: "empty_model_response", clipped },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (parseErr) {
      logError("model", parseErr, { snippet: raw.slice(0, 200) });
      const fallback = heuristicExtractQuestionTexts(rawText);
      return json({
        ok: true,
        questions: finalizeList(fallback, documentTitle),
        source: "heuristic",
        meta: { reason: "invalid_json", clipped },
      });
    }

    if (!isAiQuestionsJson(parsed)) {
      logError("validation", "schema mismatch");
      const fallback = heuristicExtractQuestionTexts(rawText);
      return json({
        ok: true,
        questions: finalizeList(fallback, documentTitle),
        source: "heuristic",
        meta: { reason: "schema_mismatch", clipped },
      });
    }

    const finalized = finalizeList(
      parsed.questions.map((q) => ({
        text: q.text,
        questionType: q.questionType,
        options: q.options,
        marks: q.marks,
      })),
      documentTitle
    ).filter((q) => q.prompt.length >= 12);

    if (finalized.length === 0) {
      const fallback = heuristicExtractQuestionTexts(rawText);
      return json({
        ok: true,
        questions: finalizeList(fallback, documentTitle),
        source: "heuristic",
        meta: { reason: "model_returned_empty", clipped },
      });
    }

    return json({
      ok: true,
      questions: finalized,
      source: "openai",
      meta: { clipped, inputChars: textForModel.length },
    });
  } catch (e) {
    logError("openai", e, { documentTitle });
    const fallback = heuristicExtractQuestionTexts(rawText);
    return json({
      ok: true,
      questions: finalizeList(fallback, documentTitle),
      source: "heuristic",
      meta: {
        reason: e instanceof Error ? e.message : "openai_error",
        clipped,
      },
    });
  }
}
