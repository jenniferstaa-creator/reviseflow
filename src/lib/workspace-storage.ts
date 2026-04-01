/**
 * localStorage persistence for ReviseFlow workspace.
 * TODO(DB): replace with API + IndexedDB for large payloads; keep shapes compatible.
 */

import type {
  AppState,
  ConceptReviewProgressState,
  DocumentContentSource,
  MockPracticePaper,
  MockPracticeQuestion,
  PracticeQuestionType,
  QuizSource,
  StudyPracticeQuestion,
  StudyPracticeSet,
  SubjectAggregateAnalysis,
  SubjectAnalysisMeta,
  SubjectWorkspace,
  SummarySource,
} from "@/data/types";
import { classifyPracticeQuestion } from "@/lib/practice-question-classify";

export const WORKSPACE_STORAGE_KEY = "reviseflow-workspace-v1";

const INITIAL: AppState = {
  version: 1,
  subjects: [],
};

function stripUndefined<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function loadWorkspaceState(): AppState {
  if (typeof window === "undefined") return INITIAL;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return INITIAL;

    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as AppState).version !== 1 ||
      !Array.isArray((parsed as AppState).subjects)
    ) {
      return INITIAL;
    }

    return migrateIfNeeded(parsed as AppState);
  } catch {
    return INITIAL;
  }
}

export function saveWorkspaceState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(stripUndefined(state))
    );
  } catch {
    /* quota / private mode */
  }
}

function readStructuredPrompt(q: Record<string, unknown>): string {
  const p = q.prompt ?? q.promptText;
  return typeof p === "string" ? p : String(p ?? "");
}

function readStructuredCorrectAnswer(q: Record<string, unknown>): string | null {
  const a = q.correctAnswer ?? q.correctSelection;
  if (typeof a === "string") {
    const t = a.trim();
    return t.length ? t : null;
  }
  return null;
}

function readStructuredMarks(q: Record<string, unknown>): number | null {
  const m = q.marks;
  return typeof m === "number" && Number.isFinite(m) ? m : null;
}

function readStructuredSource(q: Record<string, unknown>): string {
  const s = q.source ?? q.sourceLabel;
  return typeof s === "string" ? s.trim() : String(s ?? "").trim();
}

function migrateMockPracticeQuestionRow(
  q: Record<string, unknown>
): MockPracticeQuestion {
  const prompt = readStructuredPrompt(q);
  const qt = q.questionType;
  const opts = q.options;
  const sharedEval = {
    userAnswer: String(q.userAnswer ?? ""),
    selectionIsCorrect:
      q.selectionIsCorrect === true ||
      q.selectionIsCorrect === false ||
      q.selectionIsCorrect === null
        ? (q.selectionIsCorrect as boolean | null)
        : null,
    suggestedAnswer:
      typeof q.suggestedAnswer === "string" ? q.suggestedAnswer : null,
    keyPoints: Array.isArray(q.keyPoints)
      ? (q.keyPoints as string[]).filter((x) => typeof x === "string")
      : [],
    feedback: typeof q.feedback === "string" ? q.feedback : null,
    strongerPhrasing:
      typeof q.strongerPhrasing === "string" ? q.strongerPhrasing : null,
    markedDifficult: Boolean(q.markedDifficult),
    savedForLater: Boolean(q.savedForLater),
    evaluatedAt: typeof q.evaluatedAt === "string" ? q.evaluatedAt : null,
  };
  if (
    typeof qt === "string" &&
    Array.isArray(opts) &&
    opts.every((x) => typeof x === "string")
  ) {
    return {
      id: String(q.id ?? ""),
      prompt: prompt.trim(),
      questionType: qt as PracticeQuestionType,
      options: opts as string[],
      correctAnswer: readStructuredCorrectAnswer(q),
      marks: readStructuredMarks(q),
      source: readStructuredSource(q),
      ...sharedEval,
    };
  }
  const c = classifyPracticeQuestion(prompt);
  return {
    id: String(q.id ?? ""),
    prompt: c.prompt,
    questionType: c.questionType,
    options: c.options,
    correctAnswer: readStructuredCorrectAnswer(q),
    marks: readStructuredMarks(q),
    source: readStructuredSource(q),
    ...sharedEval,
  };
}

function migrateStudyPracticeQuestionRow(
  q: Record<string, unknown>
): StudyPracticeQuestion {
  const prompt = readStructuredPrompt(q);
  const qt = q.questionType;
  const opts = q.options;
  const sharedStudy = {
    sourceDocumentId:
      typeof q.sourceDocumentId === "string" ? q.sourceDocumentId : null,
    suggestedAnswer: String(q.suggestedAnswer ?? ""),
    keyPoints: Array.isArray(q.keyPoints)
      ? (q.keyPoints as string[]).filter((x) => typeof x === "string")
      : [],
    userAnswer: String(q.userAnswer ?? ""),
    selectionIsCorrect:
      q.selectionIsCorrect === true ||
      q.selectionIsCorrect === false ||
      q.selectionIsCorrect === null
        ? (q.selectionIsCorrect as boolean | null)
        : null,
    revealedAnswer: Boolean(q.revealedAnswer),
    revealedKeyPoints: Boolean(q.revealedKeyPoints),
    feedback: typeof q.feedback === "string" ? q.feedback : null,
    strongerPhrasing:
      typeof q.strongerPhrasing === "string" ? q.strongerPhrasing : null,
    markedDifficult: Boolean(q.markedDifficult),
    savedForLater: Boolean(q.savedForLater),
    evaluatedAt: typeof q.evaluatedAt === "string" ? q.evaluatedAt : null,
  };
  if (
    typeof qt === "string" &&
    Array.isArray(opts) &&
    opts.every((x) => typeof x === "string")
  ) {
    return {
      id: String(q.id ?? ""),
      prompt: prompt.trim(),
      questionType: qt as PracticeQuestionType,
      options: opts as string[],
      correctAnswer: readStructuredCorrectAnswer(q),
      marks: readStructuredMarks(q),
      source: readStructuredSource(q),
      ...sharedStudy,
    };
  }
  const c = classifyPracticeQuestion(prompt);
  return {
    id: String(q.id ?? ""),
    prompt: c.prompt,
    questionType: c.questionType,
    options: c.options,
    correctAnswer: readStructuredCorrectAnswer(q),
    marks: readStructuredMarks(q),
    source: readStructuredSource(q),
    ...sharedStudy,
  };
}

/** Extend when schema changes. */
function migrateIfNeeded(state: AppState): AppState {
  const subjects = state.subjects.map((s) => ({
    ...s,
    documents: (s.documents ?? []).map((d) => {
      const hasText = ((d as StudyDocumentCompat).extractedText ?? "").length > 0;
      const hadMockMaterials =
        (d.summary != null || d.quiz != null) && !hasText;
      return {
        ...d,
        analysisStep: d.analysisStep ?? null,
        summary: d.summary ?? null,
        quiz: d.quiz ?? null,
        extractedText: (d as StudyDocumentCompat).extractedText ?? "",
        textPreview: (d as StudyDocumentCompat).textPreview ?? "",
        pageCount: (d as StudyDocumentCompat).pageCount ?? null,
        parseSucceeded:
          typeof (d as StudyDocumentCompat).parseSucceeded === "boolean"
            ? (d as StudyDocumentCompat).parseSucceeded!
            : hasText,
        parseErrorMessage: (d as StudyDocumentCompat).parseErrorMessage,
        textTruncated: (d as StudyDocumentCompat).textTruncated,
        contentSource: ((): DocumentContentSource | undefined => {
          const c = (d as StudyDocumentCompat).contentSource;
          if (c === "legacy-mock" || c === "extracted") return c;
          return hadMockMaterials ? "legacy-mock" : "extracted";
        })(),
        summarySource: ((): SummarySource | undefined => {
          const s = (d as StudyDocumentCompat).summarySource;
          if (s === "openai" || s === "heuristic" || s === "legacy-mock") {
            return s;
          }
          if (hadMockMaterials) return "legacy-mock";
          if (hasText && d.summary) return "heuristic";
          return undefined;
        })(),
        summaryError: (d as StudyDocumentCompat).summaryError,
        quizSource: ((): QuizSource | undefined => {
          const q = (d as StudyDocumentCompat).quizSource;
          if (q === "openai" || q === "heuristic" || q === "legacy-mock") {
            return q;
          }
          if (hadMockMaterials) return "legacy-mock";
          if (hasText && d.quiz) return "heuristic";
          return undefined;
        })(),
        quizError: (d as StudyDocumentCompat).quizError,
      };
    }),
    mistakes: (s.mistakes ?? []).map((m) => ({
      ...m,
      documentId:
        (m as MistakeRecordCompat).documentId ?? "legacy-unknown",
    })),
    selectedDocumentId: s.selectedDocumentId ?? null,
    exam: s.exam ?? null,
    dailyPlan: s.dailyPlan ?? [],
    subjectAnalysis:
      (s as SubjectWorkspaceCompat).subjectAnalysis ?? null,
    subjectAnalysisMeta:
      (s as SubjectWorkspaceCompat).subjectAnalysisMeta ?? null,
    conceptReviewByKey:
      (s as SubjectWorkspaceCompat).conceptReviewByKey ?? {},
    mockPracticePapers: (
      (s as SubjectWorkspaceCompat).mockPracticePapers ?? []
    ).map((p) => ({
      ...p,
      questions: (p.questions ?? []).map((q) =>
        migrateMockPracticeQuestionRow(q as unknown as Record<string, unknown>)
      ),
    })),
    studyPracticeSets: (
      (s as SubjectWorkspaceCompat).studyPracticeSets ?? []
    ).map((st) => ({
      ...st,
      questions: (st.questions ?? []).map((q) =>
        migrateStudyPracticeQuestionRow(q as unknown as Record<string, unknown>)
      ),
    })),
    accent: s.accent ?? "teal",
    icon: s.icon ?? "book-open",
  }));

  return { ...state, subjects };
}

type MistakeRecordCompat = { documentId?: string };

type SubjectWorkspaceCompat = {
  subjectAnalysis?: SubjectAggregateAnalysis | null;
  subjectAnalysisMeta?: SubjectAnalysisMeta | null;
  conceptReviewByKey?: Record<string, ConceptReviewProgressState>;
  mockPracticePapers?: MockPracticePaper[];
  studyPracticeSets?: StudyPracticeSet[];
};

type StudyDocumentCompat = {
  extractedText?: string;
  textPreview?: string;
  pageCount?: number | null;
  parseSucceeded?: boolean;
  parseErrorMessage?: string;
  textTruncated?: boolean;
  contentSource?: string;
  summarySource?: string;
  summaryError?: string;
  quizSource?: string;
  quizError?: string;
};

export function findSubject(
  state: AppState,
  subjectId: string
): SubjectWorkspace | undefined {
  return state.subjects.find((s) => s.id === subjectId);
}
