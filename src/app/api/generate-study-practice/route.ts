import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type { StudyPracticeMode } from "@/data/types";
import type { StudyPracticeBundle } from "@/lib/study-practice-payload";
import {
  canonCorrectAnswer,
  normalizeAiQuestionShape,
} from "@/lib/practice-question-classify";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "generate_study_practice" as const;

const MAX_BUNDLE_JSON = 110_000;

function logError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:generate-study-practice]", context, {
    stage: STAGE,
    ...extra,
    message,
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

function isMode(x: unknown): x is StudyPracticeMode {
  return (
    x === "quick_check" || x === "exam_style" || x === "weak_area_drill"
  );
}

type AiQuestion = {
  prompt?: string;
  promptText?: string;
  suggestedAnswer: string;
  keyPoints: string[];
  source?: string;
  sourceLabel?: string;
  sourceDocumentId: string | null;
  questionType?: string;
  options?: string[];
  correctAnswer?: string | null;
  correctSelection?: string | null;
  marks?: number | string | null;
};

type AiResponse = { questions: AiQuestion[] };

function isAiResponse(data: unknown): data is AiResponse {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.questions)) return false;
  for (const q of o.questions) {
    if (!q || typeof q !== "object") return false;
    const row = q as Record<string, unknown>;
    if (
      typeof row.prompt !== "string" &&
      typeof row.promptText !== "string"
    ) {
      return false;
    }
    if (typeof row.suggestedAnswer !== "string") return false;
    if (
      !Array.isArray(row.keyPoints) ||
      !row.keyPoints.every((k) => typeof k === "string")
    ) {
      return false;
    }
    if (
      typeof row.source !== "string" &&
      typeof row.sourceLabel !== "string"
    ) {
      return false;
    }
    if (
      row.sourceDocumentId != null &&
      typeof row.sourceDocumentId !== "string"
    ) {
      return false;
    }
    if (row.questionType != null && typeof row.questionType !== "string") {
      return false;
    }
    if (
      row.options != null &&
      (!Array.isArray(row.options) ||
        !row.options.every((k) => typeof k === "string"))
    ) {
      return false;
    }
    if (
      row.correctAnswer != null &&
      typeof row.correctAnswer !== "string"
    ) {
      return false;
    }
    if (
      row.correctSelection != null &&
      typeof row.correctSelection !== "string"
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
  }
  return true;
}

function parseMarks(raw: unknown): number | null {
  if (raw == null) return null;
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

function questionTarget(mode: StudyPracticeMode): number {
  switch (mode) {
    case "quick_check":
      return 6;
    case "exam_style":
      return 4;
    case "weak_area_drill":
      return 5;
    default:
      return 5;
  }
}

function modeInstructions(mode: StudyPracticeMode): string {
  switch (mode) {
    case "quick_check":
      return `MODE quick_check: Short checks. Include a MIX: about half via true_false or multiple_choice when the material supports clear factual checks; the rest short_answer. Only use essay if needed for a single synthesising item.`;
    case "exam_style":
      return `MODE exam_style: Mostly short_answer and essay (comparison, explain why, apply). You may include at most one multiple_choice or true_false if it fits a defensible key idea.`;
    case "weak_area_drill":
      return `MODE weak_area_drill: Target mistakes and weak areas. Use a MIX of question types: include several selection questions (true_false / multiple_choice) that probe misconceptions, plus written items that force explanation.`;
    default:
      return "";
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logError("config", "OPENAI_API_KEY missing");
    return json(
      {
        ok: false,
        error:
          "OPENAI_API_KEY is missing. Add it to .env.local to generate practice.",
      },
      503
    );
  }

  let body: {
    mode?: unknown;
    scope?: unknown;
    sourceDocumentId?: unknown;
    bundle?: unknown;
  };
  try {
    body = await req.json();
  } catch (e) {
    logError("request_json", e);
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (!isMode(body.mode)) {
    return json({ ok: false, error: "Invalid or missing mode." }, 400);
  }
  const mode = body.mode;

  if (body.scope !== "single" && body.scope !== "all") {
    return json({ ok: false, error: "scope must be 'single' or 'all'." }, 400);
  }
  const scope = body.scope;

  const sourceDocumentId =
    typeof body.sourceDocumentId === "string"
      ? body.sourceDocumentId
      : null;

  const bundle = body.bundle as StudyPracticeBundle | undefined;
  if (
    !bundle ||
    typeof bundle !== "object" ||
    !Array.isArray(bundle.documents)
  ) {
    return json({ ok: false, error: "Invalid or missing bundle." }, 400);
  }

  if (bundle.documents.length === 0) {
    return json(
      {
        ok: false,
        error:
          "No usable PDF text in scope. Upload and process study PDFs first.",
      },
      400
    );
  }

  const allowedIds = new Set(bundle.documents.map((d) => d.id));
  if (scope === "single" && sourceDocumentId && !allowedIds.has(sourceDocumentId)) {
    return json({ ok: false, error: "sourceDocumentId not in bundle." }, 400);
  }

  let bundleStr = JSON.stringify(bundle);
  if (bundleStr.length > MAX_BUNDLE_JSON) {
    bundleStr = `${bundleStr.slice(0, MAX_BUNDLE_JSON)}\n[TRUNCATED]`;
  }

  const n = questionTarget(mode);

  const system = `You write revision questions for university students from their own course materials.
You receive JSON with: subjectName, documents (each with id, fileName, textSample from PDF extract, optional summary), mistakes, weakestAreas, topConcepts, masteryWeakHints.
Rules:
- Ground every question ONLY in the provided text samples and summaries. Do not invent facts not supported by the bundle.
- If extracts are thin, ask narrower questions and note assumptions briefly in suggestedAnswer only when unavoidable.
- ${modeInstructions(mode)}
- Produce exactly ${n} questions.
- Each question must set "source" to a clear label (usually the fileName) for attribution.
- sourceDocumentId must be the document id string from the bundle that best matches the question, or null if unclear.

Each question MUST include:
- prompt: string (the question stem only when options are listed separately; otherwise full text)
- questionType: one of "true_false", "multiple_choice", "short_answer", "essay"
- options: string[] (empty for true_false, short_answer, essay; for multiple_choice supply 3-5 distinct option strings without letter prefixes)
- correctAnswer: for true_false exactly "True" or "False"; for multiple_choice the exact option text that is correct; for short_answer and essay use null
- marks: number | null — typical points if you want to simulate exam weighting (e.g. 2); null is fine

Return ONLY valid JSON:
{ "questions": [ { "prompt": string, "suggestedAnswer": string, "keyPoints": string[] (4-8 strings), "source": string, "sourceDocumentId": string | null, "questionType": string, "options": string[], "correctAnswer": string | null, "marks": number | null } ] }`;

  const userPrefix = `subjectName: ${bundle.subjectName}
scope: ${scope}
${mode === "weak_area_drill" ? `mistakes_count: ${bundle.mistakes?.length ?? 0}\n` : ""}
BUNDLE_JSON:
`;

  const userMessage = `${userPrefix}${bundleStr}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_STUDY_PRACTICE_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      logError("model", "empty completion");
      return json({ ok: false, error: "Empty response from model." }, 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (parseErr) {
      logError("model", parseErr, { snippet: raw.slice(0, 200) });
      return json({ ok: false, error: "Model did not return valid JSON." }, 502);
    }

    if (!isAiResponse(parsed)) {
      logError("validation", "schema mismatch");
      return json(
        { ok: false, error: "Model JSON did not match the expected schema." },
        502
      );
    }

    const questions = parsed.questions
      .map((q) => {
        const promptIn = String(q.prompt ?? q.promptText ?? "").trim();
        const sourceIn = String(q.source ?? q.sourceLabel ?? "").trim();
        const shaped = normalizeAiQuestionShape({
          prompt: promptIn,
          questionType: q.questionType,
          options: q.options,
        });
        const correctAnswer = canonCorrectAnswer(
          shaped,
          q.correctAnswer ?? q.correctSelection ?? null
        );
        return {
          prompt: shaped.prompt,
          questionType: shaped.questionType,
          options: shaped.options,
          correctAnswer,
          marks: parseMarks(q.marks ?? null),
          source: sourceIn,
          suggestedAnswer: q.suggestedAnswer.trim(),
          keyPoints: q.keyPoints.map((s) => s.trim()).filter(Boolean),
          sourceDocumentId:
            typeof q.sourceDocumentId === "string" &&
            allowedIds.has(q.sourceDocumentId)
              ? q.sourceDocumentId
              : null,
        };
      })
      .filter((q) => q.prompt.length >= 12 && q.suggestedAnswer.length > 0);

    if (questions.length === 0) {
      return json(
        { ok: false, error: "Model produced no usable questions." },
        502
      );
    }

    return json({
      ok: true,
      questions,
      meta: {
        mode,
        scope,
        requestedCount: n,
        returnedCount: questions.length,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "OpenAI request failed unexpectedly.";
    logError("openai", e);
    return json({ ok: false, error: message }, 502);
  }
}
