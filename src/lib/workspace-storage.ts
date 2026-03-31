/**
 * localStorage persistence for ReviseFlow workspace.
 * TODO(DB): replace with API + IndexedDB for large payloads; keep shapes compatible.
 */

import type { AppState, SubjectWorkspace } from "@/data/types";

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
    documents: (s.documents ?? []).map((d) => ({
      ...d,
      analysisStep: d.analysisStep ?? null,
      summary: d.summary ?? null,
      quiz: d.quiz ?? null,
    })),
    mistakes: (s.mistakes ?? []).map((m) => ({
      ...m,
      documentId:
        (m as MistakeRecordCompat).documentId ?? "legacy-unknown",
    })),
    selectedDocumentId: s.selectedDocumentId ?? null,
    exam: s.exam ?? null,
    dailyPlan: s.dailyPlan ?? [],
    accent: s.accent ?? "teal",
    icon: s.icon ?? "book-open",
  }));

  return { ...state, subjects };
}

type MistakeRecordCompat = { documentId?: string };

export function findSubject(
  state: AppState,
  subjectId: string
): SubjectWorkspace | undefined {
  return state.subjects.find((s) => s.id === subjectId);
}
