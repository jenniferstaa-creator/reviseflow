import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type { PracticeQuestionType } from "@/data/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "mock_practice_evaluate" as const;

const MAX_QUESTION_CHARS = 12_000;
const MAX_USER_ANSWER_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 28_000;

function logError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:mock-practice-evaluate]", context, {
    stage: STAGE,
    ...extra,
    message,
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

type EvaluateJson = {
  suggestedAnswer: string;
  keyPoints: string[];
  feedback: string;
  strongerPhrasing: string;
  isCorrect: boolean | null;
  correctAnswer: string | null;
};

function isEvaluateJson(data: unknown): data is EvaluateJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.suggestedAnswer !== "string") return false;
  if (
    !Array.isArray(o.keyPoints) ||
    !o.keyPoints.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (typeof o.feedback !== "string") return false;
  if (typeof o.strongerPhrasing !== "string") return false;
  if (!("isCorrect" in o)) return false;
  if (o.isCorrect !== null && typeof o.isCorrect !== "boolean") return false;
  if (!("correctAnswer" in o)) return false;
  if (o.correctAnswer !== null && typeof o.correctAnswer !== "string") {
    return false;
  }
  return true;
}

function isQuestionType(x: unknown): x is PracticeQuestionType {
  return (
    x === "true_false" ||
    x === "multiple_choice" ||
    x === "short_answer" ||
    x === "essay"
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logError("config", "OPENAI_API_KEY missing");
    return json(
      {
        ok: false,
        error:
          "OPENAI_API_KEY is missing. Add it to .env.local for AI feedback.",
      },
      503
    );
  }

  let body: {
    questionText?: string;
    userAnswer?: string;
    subjectName?: string;
    subjectContext?: string;
    questionType?: unknown;
    options?: unknown;
  };
  try {
    body = await req.json();
  } catch (e) {
    logError("request_json", e);
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const questionText =
    typeof body.questionText === "string" ? body.questionText.trim() : "";
  if (!questionText.length) {
    return json({ ok: false, error: "questionText is required." }, 400);
  }

  const userAnswer =
    typeof body.userAnswer === "string" ? body.userAnswer.trim() : "";

  const subjectName =
    typeof body.subjectName === "string" && body.subjectName.trim()
      ? body.subjectName.trim()
      : "Subject";

  const subjectContext =
    typeof body.subjectContext === "string" ? body.subjectContext.trim() : "";

  const questionType: PracticeQuestionType | null = isQuestionType(
    body.questionType
  )
    ? body.questionType
    : null;

  const options = Array.isArray(body.options)
    ? body.options.filter((x): x is string => typeof x === "string")
    : [];

  const q = questionText.slice(0, MAX_QUESTION_CHARS);
  const u = userAnswer.slice(0, MAX_USER_ANSWER_CHARS);
  const ctx = subjectContext.slice(0, MAX_CONTEXT_CHARS);

  const system = `You are an exam coach. The student is practising past-paper style questions.
You receive the question, their answer (may be empty), QUESTION_TYPE, OPTIONS when applicable, optional course JSON context, and subject name.
Return ONLY a JSON object with these exact keys (no markdown):
- suggestedAnswer: string (clear model answer; for MCQ/TF state the correct choice plainly first, then brief justification if useful)
- keyPoints: string[] (4–8 bullets for full marks)
- feedback: string (2–5 sentences on their answer; for selection questions say what was wrong if incorrect)
- strongerPhrasing: string (exam-polished version of their answer, or minimal improved answer if they left it empty)
- isCorrect: boolean or null — Use null for short_answer and essay, OR when the student provided no answer. For true_false and multiple_choice when the student gave a selection (not empty), set true only if their selection matches the single best answer you infer; otherwise false. If OPTIONS are listed, the correct answer must be one of them.
- correctAnswer: string or null — Brief canonical correct response: for TF exactly "True" or "False"; for MCQ the exact option text from OPTIONS; for short_answer/essay null unless one short rubric line is natural.`;

  const userBlock = `SUBJECT: ${subjectName}
QUESTION_TYPE: ${questionType ?? "unknown"}
OPTIONS_JSON: ${JSON.stringify(options.slice(0, 12))}

QUESTION:
${q}

STUDENT_ANSWER:
${u.length ? u : "(empty — set isCorrect to null; still fill suggestedAnswer and keyPoints)"}

COURSE_CONTEXT_JSON (optional):
${ctx.length ? ctx : "{}"}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MOCK_EVAL_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userBlock },
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

    if (!isEvaluateJson(parsed)) {
      logError("validation", "schema mismatch");
      return json(
        { ok: false, error: "Model JSON did not match the expected schema." },
        502
      );
    }

    let isCorrect = parsed.isCorrect;
    if (
      questionType !== "true_false" &&
      questionType !== "multiple_choice"
    ) {
      isCorrect = null;
    }
    if (!u.length) {
      isCorrect = null;
    }

    let correctAnswer: string | null =
      parsed.correctAnswer === null
        ? null
        : typeof parsed.correctAnswer === "string"
          ? parsed.correctAnswer.trim() || null
          : null;
    if (
      questionType !== "true_false" &&
      questionType !== "multiple_choice"
    ) {
      correctAnswer = null;
    }

    return json({
      ok: true,
      suggestedAnswer: parsed.suggestedAnswer.trim(),
      keyPoints: parsed.keyPoints.map((s) => s.trim()).filter(Boolean),
      feedback: parsed.feedback.trim(),
      strongerPhrasing: parsed.strongerPhrasing.trim(),
      isCorrect,
      correctAnswer,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "OpenAI request failed unexpectedly.";
    logError("openai", e);
    return json({ ok: false, error: message }, 502);
  }
}
