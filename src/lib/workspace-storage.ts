/**
 * localStorage persistence for ReviseFlow workspace.
 * TODO(DB): replace with API + IndexedDB for large payloads; keep shapes compatible.
 */

import type {
  AppState,
  ConceptReviewProgressState,
  DocumentContentSource,
  QuizSource,
  SubjectAggregateAnalysis,
  SubjectAnalysisMeta,
  SubjectWorkspace,
  SummarySource,
} from "@/data/types";

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
