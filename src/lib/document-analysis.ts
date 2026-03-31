import type { CourseSummary, QuizContent, QuizSource, SummarySource } from "@/data/types";
import { buildQuizFromExtractedText } from "@/lib/generate-from-text";
import { MIN_EXTRACT_MEANINGFUL_CHARS } from "@/lib/pdf-constants";

export type DocumentAiMeta = {
  summaryInputChars?: number;
  summarySentToModel?: number;
  summaryTotalExtractChars?: number;
  summaryTruncated?: boolean;
  summarySkippedReason?: string;
  quizInputChars?: number;
  quizSentToModel?: number;
  quizTotalExtractChars?: number;
  quizTruncated?: boolean;
};

export type OpenAiPipelineResult = {
  summary: CourseSummary | null;
  summarySource?: SummarySource;
  summaryError?: string;
  quiz: QuizContent;
  quizSource: QuizSource;
  quizError?: string;
  meta: DocumentAiMeta;
};

/**
 * Runs summary + quiz API calls (and heuristic fallbacks) for already-extracted text.
 */
export async function runOpenAiPipeline(opts: {
  text: string;
  documentId: string;
  subjectId: string;
  documentTitle: string;
  pageCount: number | null;
  /** True if text was clipped to localStorage max before calling this. */
  textWasClippedForStorage: boolean;
}): Promise<OpenAiPipelineResult> {
  const {
    text,
    documentId,
    subjectId,
    documentTitle,
    pageCount,
    textWasClippedForStorage,
  } = opts;

  const meta: DocumentAiMeta = {};

  if (text.length < MIN_EXTRACT_MEANINGFUL_CHARS) {
    meta.summarySkippedReason = `below_threshold_${text.length}`;
    const summaryError = `Extracted text is only ${text.length} character${text.length === 1 ? "" : "s"} (typical readable PDFs yield at least ~${MIN_EXTRACT_MEANINGFUL_CHARS}). This file may be image-based, heavily scanned, or protected—OCR is not enabled in this build.`;
    const quiz = buildQuizFromExtractedText(text, documentId);
    return {
      summary: null,
      summaryError,
      quiz,
      quizSource: "heuristic",
      quizError:
        text.length > 0
          ? "Quiz uses rule-based items only; AI quiz was skipped because the extract is too short."
          : undefined,
      meta,
    };
  }

  let summary: CourseSummary | null = null;
  let summarySource: SummarySource | undefined;
  let summaryError: string | undefined;

  try {
    const summaryRes = await fetch("/api/analyze-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        documentTitle,
        pageCount,
        textWasClipped: textWasClippedForStorage,
      }),
    });

    const summaryPayload = (await summaryRes.json()) as {
      ok?: boolean;
      summary?: CourseSummary;
      error?: string;
      meta?: {
        inputChars?: number;
        clipped?: boolean;
        totalExtractChars?: number;
      };
    };

    if (summaryPayload.meta) {
      if (typeof summaryPayload.meta.inputChars === "number") {
        meta.summarySentToModel = summaryPayload.meta.inputChars;
      }
      if (typeof summaryPayload.meta.totalExtractChars === "number") {
        meta.summaryTotalExtractChars = summaryPayload.meta.totalExtractChars;
      }
      meta.summaryTruncated = Boolean(summaryPayload.meta.clipped);
    }
    meta.summaryInputChars = text.length;

    if (summaryRes.ok && summaryPayload.ok && summaryPayload.summary) {
      summary = summaryPayload.summary;
      summarySource = "openai";
    } else {
      const detail =
        typeof summaryPayload.error === "string"
          ? summaryPayload.error
          : `HTTP ${summaryRes.status}`;
      summaryError = detail;
    }
  } catch (e) {
    summaryError =
      e instanceof Error ? e.message : "Summary request failed unexpectedly.";
    meta.summaryInputChars = text.length;
  }

  let quiz: QuizContent;
  let quizSource: QuizSource;
  let quizError: string | undefined;

  try {
    const quizRes = await fetch("/api/analyze-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        documentTitle,
        documentId,
        subjectId,
        pageCount,
        textWasClipped: textWasClippedForStorage,
      }),
    });

    const quizPayload = (await quizRes.json()) as {
      ok?: boolean;
      quiz?: QuizContent;
      error?: string;
      meta?: {
        inputChars?: number;
        clipped?: boolean;
        totalExtractChars?: number;
      };
    };

    if (quizPayload.meta) {
      if (typeof quizPayload.meta.inputChars === "number") {
        meta.quizSentToModel = quizPayload.meta.inputChars;
      }
      if (typeof quizPayload.meta.totalExtractChars === "number") {
        meta.quizTotalExtractChars = quizPayload.meta.totalExtractChars;
      }
      meta.quizTruncated = Boolean(quizPayload.meta.clipped);
    }
    meta.quizInputChars = text.length;

    if (quizRes.ok && quizPayload.ok && quizPayload.quiz) {
      quiz = quizPayload.quiz;
      quizSource = "openai";
    } else {
      throw new Error(
        typeof quizPayload.error === "string"
          ? quizPayload.error
          : `Quiz API failed (${quizRes.status})`
      );
    }
  } catch (e) {
    quiz = buildQuizFromExtractedText(text, documentId);
    quizSource = "heuristic";
    const detail =
      e instanceof Error ? e.message : "Quiz AI request failed unexpectedly.";
    quizError = `OpenAI quiz generation did not complete. Using rule-based questions from this PDF’s text. ${detail}`;
  }

  return {
    summary,
    summarySource,
    summaryError,
    quiz,
    quizSource,
    quizError,
    meta,
  };
}
