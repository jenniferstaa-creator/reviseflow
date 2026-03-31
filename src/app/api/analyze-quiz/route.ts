import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type { QuizContent, QuizQuestionMCQ, QuizQuestionShort } from "@/data/types";
import { MAX_QUIZ_INPUT_CHARS } from "@/lib/quiz-api";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "openai_quiz" as const;

function logQuizError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:analyze-quiz]", context, {
    stage: STAGE,
    ...extra,
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
}

function quizJson(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

type AiMcq = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
};

type AiShort = {
  question: string;
  sampleAnswer: string;
  explanation: string;
  conceptTag: string;
};

type AiQuizJson = {
  multipleChoiceQuestions: AiMcq[];
  shortAnswerQuestions: AiShort[];
};

function isAiQuizJson(data: unknown): data is AiQuizJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.multipleChoiceQuestions)) return false;
  if (!Array.isArray(o.shortAnswerQuestions)) return false;

  for (const m of o.multipleChoiceQuestions) {
    if (!m || typeof m !== "object") return false;
    const x = m as Record<string, unknown>;
    if (typeof x.question !== "string") return false;
    if (!Array.isArray(x.options) || x.options.length !== 4) return false;
    if (!x.options.every((opt) => typeof opt === "string")) return false;
    if (typeof x.correctAnswer !== "string") return false;
    if (typeof x.explanation !== "string") return false;
    if (typeof x.conceptTag !== "string") return false;
  }

  for (const s of o.shortAnswerQuestions) {
    if (!s || typeof s !== "object") return false;
    const x = s as Record<string, unknown>;
    if (typeof x.question !== "string") return false;
    if (typeof x.sampleAnswer !== "string") return false;
    if (typeof x.explanation !== "string") return false;
    if (typeof x.conceptTag !== "string") return false;
  }

  return true;
}

/** Minimum counts scale down for very short extracts so the model isn’t forced to invent filler. */
function minQuizCounts(extractCharLength: number): { mcq: number; sa: number } {
  if (extractCharLength < 900) return { mcq: 2, sa: 1 };
  if (extractCharLength < 2800) return { mcq: 3, sa: 2 };
  return { mcq: 5, sa: 3 };
}

function normalizeQuiz(
  data: AiQuizJson,
  documentId: string,
  extractCharLength: number
): QuizContent | null {
  const multipleChoice: QuizQuestionMCQ[] = [];

  for (let i = 0; i < data.multipleChoiceQuestions.length; i++) {
    const m = data.multipleChoiceQuestions[i];
    const options = m.options.map((o) => o.trim()).filter(Boolean);
    if (options.length !== 4) return null;
    const uniq = new Set(options);
    if (uniq.size !== 4) return null;

    const correct = m.correctAnswer.trim();
    if (!correct || !options.includes(correct)) return null;
    const qn = m.question.trim();
    if (!qn) return null;

    multipleChoice.push({
      id: `${documentId}-ai-mcq-${i + 1}`,
      type: "mcq",
      question: qn,
      options,
      correctAnswer: correct,
      explanation: m.explanation.trim(),
      conceptTag: m.conceptTag.trim() || "General",
    });
  }

  const shortAnswer: QuizQuestionShort[] = [];
  for (let i = 0; i < data.shortAnswerQuestions.length; i++) {
    const s = data.shortAnswerQuestions[i];
    const qn = s.question.trim();
    const sa = s.sampleAnswer.trim();
    if (!qn || !sa) return null;
    shortAnswer.push({
      id: `${documentId}-ai-sa-${i + 1}`,
      type: "short",
      question: qn,
      correctAnswer: sa,
      explanation: s.explanation.trim(),
      conceptTag: s.conceptTag.trim() || "General",
    });
  }

  const { mcq: minMcq, sa: minSa } = minQuizCounts(extractCharLength);
  if (multipleChoice.length < minMcq || shortAnswer.length < minSa) {
    return null;
  }

  return { multipleChoice, shortAnswer };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      logQuizError("config", "OPENAI_API_KEY missing");
      return quizJson(
        {
          ok: false,
          error:
            "OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.",
        },
        503
      );
    }

    let body: {
      text?: string;
      documentTitle?: string;
      documentId?: string;
      subjectId?: string;
      pageCount?: number | null;
      textWasClipped?: boolean;
    };

    try {
      body = await req.json();
    } catch (jsonErr) {
      logQuizError("request_json", jsonErr);
      return quizJson({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText.length) {
      return quizJson(
        { ok: false, error: "No text provided for quiz generation." },
        400
      );
    }

    const documentId =
      typeof body.documentId === "string" && body.documentId.trim()
        ? body.documentId.trim()
        : "doc";

    const documentTitle =
      typeof body.documentTitle === "string" && body.documentTitle.trim()
        ? body.documentTitle.trim()
        : "document.pdf";

    const subjectId =
      typeof body.subjectId === "string" && body.subjectId.trim()
        ? body.subjectId.trim()
        : "subject";

    console.info("[reviseflow:analyze-quiz]", {
      stage: STAGE,
      msg: "request",
      documentId,
      documentTitle,
      extractChars: rawText.length,
    });

    const clipped =
      rawText.length > MAX_QUIZ_INPUT_CHARS || Boolean(body.textWasClipped);
    const textForModel = rawText.slice(0, MAX_QUIZ_INPUT_CHARS);

    const extractLen = textForModel.length;
    const { mcq: targetMcq, sa: targetSa } = minQuizCounts(extractLen);

    const system = `You are an expert university instructor writing revision quizzes for exams.
You receive plain text from ONE uploaded PDF. Every question, option, and model answer must be grounded ONLY in that text—no outside facts, no generic “any course” filler.

## What to prioritize (in order)
1. **Central concepts and theories** the document emphasizes (what a professor would expect students to know).
2. **Precise definitions and terminology** (terms of art, formal definitions, stated criteria).
3. **Comparisons and contrasts** (e.g. Approach A vs B, benefits vs drawbacks, when X applies vs Y)—only if the document actually discusses them.
4. **Likely exam-style prompts**: “Explain why…”, “Compare…”, “What is the role of…”, “How does … relate to…”, short scenarios that mirror claims in the text.

Use clear, academic English. Distractors in MCQs must be plausible to someone who read the text superficially but wrong for subtle reasons—not nonsense unrelated to the reading.

## Output size (critical)
- For a **normal-sized extract** (several thousand characters of substantive prose), produce **exactly 5** multiple-choice questions and **exactly 3** short-answer questions.
- If the extract is **short or thin**, produce **fewer** questions—each must be rigorous and non-redundant. Prefer **3 MCQ + 2 short** for moderate length; **2 MCQ + 1 short** only when the text is very sparse. Never pad with generic questions that could apply to any subject.

Return ONLY a single JSON object (no markdown) with exactly these keys:
- multipleChoiceQuestions: array. Each element:
  - question: string (exam-relevant, specific to this document)
  - options: array of EXACTLY 4 distinct strings (one correct; distractors grounded in the same topic area as the text)
  - correctAnswer: string (must equal one option after trimming whitespace)
  - explanation: string (2–4 sentences: why the correct option follows from the document)
  - conceptTag: string (short topic label from the material)
- shortAnswerQuestions: array. Each element:
  - question: string (prefer synthesis, comparison, or explanation of a key idea—not trivial recall unless the doc makes that term central)
  - sampleAnswer: string (strong exemplar answer a good student could write, citing ideas from the text)
  - explanation: string (what an examiner looks for; mark scheme style)
  - conceptTag: string`;

    const userPrefix =
      clipped || textForModel.length < rawText.length
        ? `NOTE: Extract may be truncated to the first ${MAX_QUIZ_INPUT_CHARS.toLocaleString()} characters.\n\n`
        : "";

    const userMessage = `${userPrefix}CONTEXT FOR YOUR OUTPUT ONLY (do not invent other files):
- subjectWorkspaceId: ${subjectId}
- documentId: ${documentId}
- fileName: ${documentTitle}
- extractLengthChars: ${extractLen}

TARGET COUNTS FOR THIS EXTRACT LENGTH: prefer **${targetMcq}** multiple-choice and **${targetSa}** short-answer question(s) as a floor; for longer rich texts use **5** MCQ and **3** short. If the text is too sparse, use fewer high-quality items as allowed above.

EXTRACTED TEXT:

${textForModel}`;

    try {
      const client = new OpenAI({ apiKey });

      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_QUIZ_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        logQuizError("model", "empty completion content", { documentId });
        return quizJson({ ok: false, error: "Empty response from model." }, 502);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch (parseErr) {
        logQuizError("model", parseErr, {
          documentId,
          snippet: raw.slice(0, 200),
        });
        return quizJson(
          { ok: false, error: "Model did not return valid JSON." },
          502
        );
      }

      if (!isAiQuizJson(parsed)) {
        logQuizError("validation", "quiz JSON schema mismatch", {
          documentId,
        });
        return quizJson(
          {
            ok: false,
            error:
              "Model JSON did not match the quiz schema (need MCQ with 4 options each, plus short answers).",
          },
          502
        );
      }

      const { mcq: needMcq, sa: needSa } = minQuizCounts(extractLen);
      const quiz = normalizeQuiz(parsed, documentId, extractLen);
      if (!quiz) {
        logQuizError("validation", "normalizeQuiz returned null", {
          documentId,
          needMcq,
          needSa,
        });
        return quizJson(
          {
            ok: false,
            error: `Model output failed validation (need at least ${needMcq} MCQ and ${needSa} short items for this extract length, 4 distinct options per MCQ, and correctAnswer matching an option).`,
          },
          502
        );
      }

      console.info("[reviseflow:analyze-quiz]", {
        stage: STAGE,
        msg: "ok",
        documentId,
        documentTitle,
        mcq: quiz.multipleChoice.length,
        short: quiz.shortAnswer.length,
        inputChars: textForModel.length,
      });

      return quizJson({
        ok: true,
        quiz,
        meta: {
          documentId,
          subjectId,
          documentTitle,
          inputChars: textForModel.length,
          totalExtractChars: rawText.length,
          clipped: clipped || textForModel.length < rawText.length,
        },
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "OpenAI quiz request failed unexpectedly.";
      logQuizError("openai", e, { documentId });
      return quizJson({ ok: false, error: message }, 502);
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "unknown error");
    logQuizError("fatal_unhandled", e, {
      hint: "Unhandled exception in analyze-quiz POST (not OpenAI-specific).",
    });
    return quizJson(
      {
        ok: false,
        error: `Quiz route failed: ${message}`,
        detail:
          "Check server logs for [reviseflow:analyze-quiz] fatal_unhandled (stage: openai_quiz).",
      },
      500
    );
  }
}
