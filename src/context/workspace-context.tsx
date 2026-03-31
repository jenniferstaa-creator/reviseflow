"use client";

import * as React from "react";
import type {
  AppState,
  ExamConfig,
  MistakeRecord,
  SubjectAccent,
  SubjectIconId,
  SubjectWorkspace,
  StudyDocument,
} from "@/data/types";
import {
  SAMPLE_MISTAKES,
  buildMockDailyPlan,
  guessErrorType,
  mockArtifactsForNewDocument,
} from "@/data/mock-course";
import {
  workspaceReducer,
  type WorkspaceAction,
  newId,
} from "@/lib/workspace-reducer";
import {
  loadWorkspaceState,
  saveWorkspaceState,
  findSubject,
} from "@/lib/workspace-storage";

const INITIAL: AppState = { version: 1, subjects: [] };

type WorkspaceContextValue = {
  hydrated: boolean;
  subjects: SubjectWorkspace[];
  dispatch: React.Dispatch<WorkspaceAction>;
  getSubject: (subjectId: string) => SubjectWorkspace | undefined;
  createSubject: (input: {
    name: string;
    examDate?: string;
    accent: SubjectAccent;
    icon: SubjectIconId;
  }) => string;
  deleteSubject: (subjectId: string) => void;
  updateSubject: (
    subjectId: string,
    patch: Partial<
      Pick<SubjectWorkspace, "name" | "examDate" | "accent" | "icon">
    >
  ) => void;
  addDocumentFromFile: (subjectId: string, file: File) => void;
  deleteDocument: (subjectId: string, docId: string) => void;
  selectDocument: (subjectId: string, docId: string | null) => void;
  addMistake: (
    subjectId: string,
    documentId: string,
    m: Omit<MistakeRecord, "id" | "createdAt" | "errorType" | "documentId"> & {
      errorType?: MistakeRecord["errorType"];
    }
  ) => void;
  clearMistakes: (subjectId: string) => void;
  loadSampleMistakes: (subjectId: string) => void;
  saveExamPlan: (subjectId: string, config: ExamConfig) => void;
  toggleDayCompleted: (subjectId: string, date: string) => void;
  setPartialPlanProgress: (
    subjectId: string,
    completedDayCount: number
  ) => void;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(
  null
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [state, dispatch] = React.useReducer(workspaceReducer, INITIAL);
  const mistakeSeq = React.useRef(0);
  const stateRef = React.useRef(state);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadWorkspaceState() });
    setHydrated(true);
  }, []);

  const persistTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  React.useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveWorkspaceState(state);
    }, 120);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state, hydrated]);

  const getSubject = React.useCallback(
    (subjectId: string) => findSubject(state, subjectId),
    [state]
  );

  const createSubject = React.useCallback(
    (input: {
      name: string;
      examDate?: string;
      accent: SubjectAccent;
      icon: SubjectIconId;
    }) => {
      const id = newId("sub");
      dispatch({
        type: "CREATE_SUBJECT",
        payload: { id, ...input },
      });
      return id;
    },
    []
  );

  const deleteSubject = React.useCallback((subjectId: string) => {
    dispatch({ type: "DELETE_SUBJECT", subjectId });
  }, []);

  const updateSubject = React.useCallback(
    (
      subjectId: string,
      patch: Partial<
        Pick<SubjectWorkspace, "name" | "examDate" | "accent" | "icon">
      >
    ) => {
      dispatch({ type: "UPDATE_SUBJECT", subjectId, patch });
    },
    []
  );

  const addDocumentFromFile = React.useCallback(
    (subjectId: string, file: File) => {
      const docId = newId("doc");
      const now = new Date().toISOString();
      const doc: StudyDocument = {
        id: docId,
        subjectId,
        fileName: file.name,
        uploadedAt: now,
        status: "uploading",
        analysisStep: "Receiving file…",
        summary: null,
        quiz: null,
      };
      dispatch({ type: "ADD_DOCUMENT", subjectId, doc });
      dispatch({ type: "SELECT_DOCUMENT", subjectId, docId });

      // TODO(PDF): replace simulation with real pipeline + job ids
      window.setTimeout(() => {
        dispatch({
          type: "UPDATE_DOCUMENT",
          subjectId,
          docId,
          patch: { status: "analyzing", analysisStep: "Extracting structure from PDF…" },
        });
      }, 900);

      window.setTimeout(() => {
        dispatch({
          type: "UPDATE_DOCUMENT",
          subjectId,
          docId,
          patch: { analysisStep: "Identifying chapters and key terms…" },
        });
      }, 2200);

      window.setTimeout(() => {
        dispatch({
          type: "UPDATE_DOCUMENT",
          subjectId,
          docId,
          patch: { analysisStep: "Drafting summary and assessment items…" },
        });
      }, 3800);

      window.setTimeout(() => {
        const { summary, quiz } = mockArtifactsForNewDocument();
        dispatch({
          type: "UPDATE_DOCUMENT",
          subjectId,
          docId,
          patch: {
            status: "ready",
            analysisStep: null,
            summary,
            quiz,
          },
        });
        // TODO(OpenAI): store per-document model output; TODO(DB): persist rows
      }, 5200);
    },
    []
  );

  const deleteDocument = React.useCallback(
    (subjectId: string, docId: string) => {
      dispatch({ type: "DELETE_DOCUMENT", subjectId, docId });
    },
    []
  );

  const selectDocument = React.useCallback(
    (subjectId: string, docId: string | null) => {
      dispatch({ type: "SELECT_DOCUMENT", subjectId, docId });
    },
    []
  );

  const addMistake = React.useCallback(
    (
      subjectId: string,
      documentId: string,
      m: Omit<MistakeRecord, "id" | "createdAt" | "errorType" | "documentId"> & {
        errorType?: MistakeRecord["errorType"];
      }
    ) => {
      const record: MistakeRecord = {
        ...m,
        documentId,
        id: `mistake-${subjectId}-${++mistakeSeq.current}`,
        errorType:
          m.errorType ??
          guessErrorType(m.userAnswer, m.correctAnswer, m.conceptTag),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MISTAKE", subjectId, mistake: record });
    },
    []
  );

  const clearMistakes = React.useCallback((subjectId: string) => {
    dispatch({ type: "CLEAR_MISTAKES", subjectId });
  }, []);

  const loadSampleMistakes = React.useCallback((subjectId: string) => {
    const sub = findSubject(stateRef.current, subjectId);
    const docId =
      sub?.documents.find((d) => d.status === "ready")?.id ?? "sample-doc";
    const seeded = SAMPLE_MISTAKES.map((row, i) => ({
      ...row,
      id: `mist-sample-${i}-${subjectId}`,
      documentId: docId,
    }));
    dispatch({ type: "SET_MISTAKES", subjectId, mistakes: seeded });
  }, []);

  const saveExamPlan = React.useCallback(
    (subjectId: string, config: ExamConfig) => {
      const plan = buildMockDailyPlan(config.date, config.hoursPerDay);
      dispatch({
        type: "SAVE_EXAM_PLAN",
        subjectId,
        exam: config,
        dailyPlan: plan,
      });
    },
    []
  );

  const toggleDayCompleted = React.useCallback(
    (subjectId: string, date: string) => {
      dispatch({ type: "TOGGLE_PLAN_DAY", subjectId, date });
    },
    []
  );

  const setPartialPlanProgress = React.useCallback(
    (subjectId: string, completedDayCount: number) => {
      dispatch({
        type: "SET_PARTIAL_PLAN",
        subjectId,
        completedDayCount,
      });
    },
    []
  );

  const value = React.useMemo(
    () => ({
      hydrated,
      subjects: state.subjects,
      dispatch,
      getSubject,
      createSubject,
      deleteSubject,
      updateSubject,
      addDocumentFromFile,
      deleteDocument,
      selectDocument,
      addMistake,
      clearMistakes,
      loadSampleMistakes,
      saveExamPlan,
      toggleDayCompleted,
      setPartialPlanProgress,
    }),
    [
      hydrated,
      state.subjects,
      getSubject,
      createSubject,
      deleteSubject,
      updateSubject,
      addDocumentFromFile,
      deleteDocument,
      selectDocument,
      addMistake,
      clearMistakes,
      loadSampleMistakes,
      saveExamPlan,
      toggleDayCompleted,
      setPartialPlanProgress,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
