"use client";

import * as React from "react";
import type {
  AppState,
  ExamConfig,
  MistakeRecord,
  SubjectAccent,
  SubjectAggregateAnalysis,
  SubjectIconId,
  SubjectWorkspace,
  StudyDocument,
} from "@/data/types";
import { SAMPLE_MISTAKES, guessErrorType } from "@/data/mock-course";
import {
  buildQuizFromExtractedText,
  buildTextPreview,
} from "@/lib/generate-from-text";
import { runOpenAiPipeline } from "@/lib/document-analysis";
import {
  MAX_EXTRACTED_TEXT_STORED,
  MIN_EXTRACT_MEANINGFUL_CHARS,
  TEXT_PREVIEW_LENGTH,
} from "@/lib/pdf-constants";
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
import {
  applyExamSprintOverlay,
  buildHeuristicDailyPlan,
} from "@/lib/exam-plan-heuristic";
import {
  buildHeuristicSubjectAggregate,
  subjectSummaryFingerprint,
} from "@/lib/subject-insights";
import { toLocalDateKey } from "@/lib/dates";

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
  retryDocumentAnalysis: (subjectId: string, docId: string) => void;
  deleteDocument: (subjectId: string, docId: string) => void;
  /** Rename display label only (does not change the original upload file on disk). */
  renameDocument: (subjectId: string, docId: string, fileName: string) => void;
  selectDocument: (subjectId: string, docId: string | null) => void;
  addMistake: (
    subjectId: string,
    documentId: string,
    m: Omit<
      MistakeRecord,
      "id" | "createdAt" | "errorType" | "documentId" | "subjectId"
    > & {
      errorType?: MistakeRecord["errorType"];
    }
  ) => void;
  removeMistakeForQuestion: (
    subjectId: string,
    documentId: string,
    questionId: string
  ) => void;
  clearMistakes: (subjectId: string) => void;
  loadSampleMistakes: (subjectId: string) => void;
  saveExamPlan: (
    subjectId: string,
    config: ExamConfig,
    opts?: { subjectAnalysis?: SubjectAggregateAnalysis | null }
  ) => Promise<void>;
  /** Regenerate subject-level synthesis from document summaries (uses OpenAI when configured). */
  refreshSubjectAnalysis: (
    subjectId: string
  ) => Promise<SubjectAggregateAnalysis | null>;
  toggleDayCompleted: (subjectId: string, date: string) => void;
  setPartialPlanProgress: (
    subjectId: string,
    completedDayCount: number
  ) => void;
  /** Update spaced-repetition state after a quiz check (correct / incorrect). */
  recordConceptReview: (
    subjectId: string,
    documentId: string,
    conceptName: string,
    outcome: "correct" | "incorrect"
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
        analysisStep: "Preparing PDF…",
        summary: null,
        quiz: null,
        extractedText: "",
        textPreview: "",
        pageCount: null,
        parseSucceeded: false,
        contentSource: "extracted",
        quizError: undefined,
      };
      dispatch({ type: "ADD_DOCUMENT", subjectId, doc });
      dispatch({ type: "SELECT_DOCUMENT", subjectId, docId });

      void (async () => {
        const patchDocument = (patch: Partial<StudyDocument>) =>
          dispatch({ type: "UPDATE_DOCUMENT", subjectId, docId, patch });

        let recoveredExtract = "";
        let recoveredPreview = "";
        let recoveredPages: number | null = null;
        let recoveredTruncated = false;
        let recoveredExtractTooShort = false;
        let recoveredLengthAtParse: number | undefined;

        try {
          patchDocument({
            status: "analyzing",
            analysisStep: "Extracting text from PDF…",
          });

          const form = new FormData();
          form.set("file", file, file.name);

          const res = await fetch("/api/parse-pdf", {
            method: "POST",
            body: form,
          });

          let payload: {
            ok?: boolean;
            text?: string;
            numPages?: number | null;
            error?: string;
            textLength?: number;
          };
          try {
            payload = (await res.json()) as typeof payload;
          } catch {
            const detail = `Invalid JSON from parse-pdf (HTTP ${res.status}).`;
            patchDocument({
              status: "error",
              analysisStep: null,
              parseSucceeded: false,
              pipelineFailureStage: "pdf_parse",
              pipelineErrorDetail: detail,
              parseErrorMessage: detail,
              errorMessage: `PDF parsing failed: ${detail}`,
            });
            return;
          }

          if (!res.ok || !payload.ok) {
            const detail =
              typeof payload.error === "string"
                ? payload.error
                : `Request failed (HTTP ${res.status})`;
            patchDocument({
              status: "error",
              analysisStep: null,
              parseSucceeded: false,
              pipelineFailureStage: "pdf_parse",
              pipelineErrorDetail: detail,
              parseErrorMessage: detail,
              errorMessage: `PDF parsing failed: ${detail}`,
            });
            return;
          }

          let text = String(payload.text ?? "").trim();
          const numPages =
            typeof payload.numPages === "number" ? payload.numPages : null;
          const rawLen =
            typeof payload.textLength === "number"
              ? payload.textLength
              : text.length;

          if (!text.length) {
            patchDocument({
              status: "error",
              analysisStep: null,
              parseSucceeded: false,
              pipelineFailureStage: "empty_extract",
              pipelineErrorDetail:
                "PDF parser returned no text after trimming. Common causes: scanned pages (bitmaps only), incorrect password/encryption, or an empty file.",
              parseErrorMessage:
                "No text could be extracted. This PDF may be image-only (scanned) or not machine-readable—OCR is not enabled in this build.",
              errorMessage:
                "No extractable text: PDF may be image-based or not machine-readable.",
              pageCount: numPages,
              extractLengthAtParse: 0,
              textPreview: "",
              extractedText: "",
            });
            return;
          }

          let textTruncated = false;
          if (text.length > MAX_EXTRACTED_TEXT_STORED) {
            text = text.slice(0, MAX_EXTRACTED_TEXT_STORED);
            textTruncated = true;
          }

          const textPreview = buildTextPreview(text, TEXT_PREVIEW_LENGTH);
          const extractTooShort = text.length < MIN_EXTRACT_MEANINGFUL_CHARS;

          recoveredExtract = text;
          recoveredPreview = textPreview;
          recoveredPages = numPages;
          recoveredTruncated = textTruncated;
          recoveredExtractTooShort = extractTooShort;
          recoveredLengthAtParse = rawLen;

          patchDocument({
            analysisStep: "Running AI summary and quiz…",
            extractedText: text,
            textPreview,
            pageCount: numPages,
            parseSucceeded: true,
            parseErrorMessage: undefined,
            textTruncated,
            errorMessage: undefined,
            summaryError: undefined,
            quizError: undefined,
            extractTooShort,
            extractLengthAtParse: rawLen,
            pipelineFailureStage: undefined,
            pipelineErrorDetail: undefined,
            lastAnalysisMeta: undefined,
          });

          const ai = await runOpenAiPipeline({
            text,
            documentId: docId,
            subjectId,
            documentTitle: file.name,
            pageCount: numPages,
            textWasClippedForStorage: textTruncated,
          });

          patchDocument({
            status: "ready",
            analysisStep: null,
            summary: ai.summary,
            quiz: ai.quiz,
            contentSource: "extracted",
            summarySource: ai.summarySource,
            summaryError: ai.summaryError,
            quizSource: ai.quizSource,
            quizError: ai.quizError,
            extractTooShort,
            extractLengthAtParse: rawLen,
            lastAnalysisMeta: ai.meta,
            pipelineFailureStage: undefined,
            pipelineErrorDetail: undefined,
            errorMessage: undefined,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unexpected error";
          if (recoveredExtract.length > 0) {
            const fallbackQuiz = buildQuizFromExtractedText(
              recoveredExtract,
              docId
            );
            patchDocument({
              status: "ready",
              analysisStep: null,
              parseSucceeded: true,
              extractedText: recoveredExtract,
              textPreview:
                recoveredPreview ||
                buildTextPreview(recoveredExtract, TEXT_PREVIEW_LENGTH),
              pageCount: recoveredPages,
              textTruncated: recoveredTruncated,
              extractTooShort: recoveredExtractTooShort,
              extractLengthAtParse: recoveredLengthAtParse,
              pipelineFailureStage: "unexpected",
              pipelineErrorDetail: msg,
              errorMessage: `Analysis interrupted after text extraction: ${msg}`,
              summary: null,
              quiz: fallbackQuiz,
              contentSource: "extracted",
              summarySource: undefined,
              quizSource: "heuristic",
              summaryError: `OpenAI summary step did not finish: ${msg}. You can retry analysis; extracted text is saved.`,
              quizError: `OpenAI quiz step did not finish: ${msg}. Showing rule-based quiz from extracted text. Retry to call the API again.`,
              lastAnalysisMeta: undefined,
            });
          } else {
            patchDocument({
              status: "error",
              analysisStep: null,
              parseSucceeded: false,
              pipelineFailureStage: "unexpected",
              pipelineErrorDetail: msg,
              parseErrorMessage: msg,
              errorMessage: msg,
            });
          }
        }
      })();
    },
    []
  );

  const retryDocumentAnalysis = React.useCallback(
    (subjectId: string, docId: string) => {
      const sub = findSubject(stateRef.current, subjectId);
      const existing = sub?.documents.find((d) => d.id === docId);
      if (!existing?.parseSucceeded || !existing.extractedText.trim()) {
        console.warn(
          "[reviseflow] retryDocumentAnalysis: need a successful extract first"
        );
        return;
      }

      void (async () => {
        const patchDocument = (patch: Partial<StudyDocument>) =>
          dispatch({ type: "UPDATE_DOCUMENT", subjectId, docId, patch });

        const text = existing.extractedText;
        const textTruncated = Boolean(existing.textTruncated);
        const numPages = existing.pageCount ?? null;

        try {
          patchDocument({
            status: "analyzing",
            analysisStep: "Re-running AI summary and quiz…",
            summaryError: undefined,
            quizError: undefined,
            pipelineFailureStage: undefined,
            pipelineErrorDetail: undefined,
            errorMessage: undefined,
            parseErrorMessage: undefined,
          });

          const ai = await runOpenAiPipeline({
            text,
            documentId: docId,
            subjectId,
            documentTitle: existing.fileName,
            pageCount: numPages,
            textWasClippedForStorage: textTruncated,
          });

          patchDocument({
            status: "ready",
            analysisStep: null,
            summary: ai.summary,
            quiz: ai.quiz,
            summarySource: ai.summarySource,
            summaryError: ai.summaryError,
            quizSource: ai.quizSource,
            quizError: ai.quizError,
            lastAnalysisMeta: ai.meta,
            extractTooShort:
              text.length < MIN_EXTRACT_MEANINGFUL_CHARS,
            pipelineFailureStage: undefined,
            pipelineErrorDetail: undefined,
            errorMessage: undefined,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Retry failed";
          patchDocument({
            status: "ready",
            analysisStep: null,
            pipelineFailureStage: "unexpected",
            pipelineErrorDetail: msg,
            errorMessage: `Retry failed: ${msg}`,
            summaryError: `Retry interrupted: ${msg}`,
          });
        }
      })();
    },
    []
  );

  const deleteDocument = React.useCallback(
    (subjectId: string, docId: string) => {
      dispatch({ type: "DELETE_DOCUMENT", subjectId, docId });
    },
    []
  );

  const renameDocument = React.useCallback(
    (subjectId: string, docId: string, fileName: string) => {
      const next = fileName.trim();
      if (!next) return;
      dispatch({
        type: "UPDATE_DOCUMENT",
        subjectId,
        docId,
        patch: { fileName: next },
      });
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
        subjectId,
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

  const removeMistakeForQuestion = React.useCallback(
    (subjectId: string, documentId: string, questionId: string) => {
      dispatch({
        type: "REMOVE_MISTAKE_FOR_QUESTION",
        subjectId,
        documentId,
        questionId,
      });
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
      subjectId,
    }));
    dispatch({ type: "SET_MISTAKES", subjectId, mistakes: seeded });
  }, []);

  const saveExamPlan = React.useCallback(
    async (
      subjectId: string,
      config: ExamConfig,
      opts?: { subjectAnalysis?: SubjectAggregateAnalysis | null }
    ) => {
      const sub = findSubject(stateRef.current, subjectId);
      if (!sub) return;
      const startDate = toLocalDateKey(new Date());
      const now = new Date().toISOString();
      const analysisForPlan =
        opts && "subjectAnalysis" in opts
          ? opts.subjectAnalysis
          : sub.subjectAnalysis;

      try {
        const res = await fetch("/api/plan-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exam: config,
            startDate,
            subjectName: sub.name,
            documents: sub.documents,
            mistakes: sub.mistakes,
            subjectAnalysis: analysisForPlan ?? null,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          dailyPlan?: import("@/data/types").DailyPlanDay[];
          source?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !Array.isArray(data.dailyPlan)) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Plan request failed"
          );
        }
        const source = data.source === "ai" ? "ai" : "heuristic";
        dispatch({
          type: "SAVE_EXAM_PLAN",
          subjectId,
          exam: {
            ...config,
            planSource: source,
            planGeneratedAt: now,
          },
          dailyPlan: data.dailyPlan,
        });
      } catch {
        const plan = applyExamSprintOverlay(
          buildHeuristicDailyPlan({
            examDateIso: config.date,
            hoursPerDay: config.hoursPerDay,
            documents: sub.documents,
            mistakes: sub.mistakes,
            subjectAnalysis: analysisForPlan ?? null,
          }),
          config.date
        );
        dispatch({
          type: "SAVE_EXAM_PLAN",
          subjectId,
          exam: {
            ...config,
            planSource: "heuristic",
            planGeneratedAt: now,
          },
          dailyPlan: plan,
        });
      }
    },
    []
  );

  const refreshSubjectAnalysis = React.useCallback(
    async (subjectId: string): Promise<SubjectAggregateAnalysis | null> => {
      const sub = findSubject(stateRef.current, subjectId);
      if (!sub) return null;
      const fingerprint = subjectSummaryFingerprint(sub.documents);

      const applyHeuristic = (): SubjectAggregateAnalysis => {
        const analysis = buildHeuristicSubjectAggregate(
          sub.name,
          sub.documents,
          sub.mistakes
        );
        dispatch({
          type: "SET_SUBJECT_ANALYSIS",
          subjectId,
          analysis,
          meta: {
            generatedAt: analysis.generatedAt,
            fingerprint,
            source: "heuristic",
          },
        });
        return analysis;
      };

      if (!fingerprint.length) {
        dispatch({
          type: "SET_SUBJECT_ANALYSIS",
          subjectId,
          analysis: null,
          meta: null,
        });
        return null;
      }

      try {
        const res = await fetch("/api/aggregate-subject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectName: sub.name,
            documents: sub.documents,
            mistakes: sub.mistakes,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          analysis?: SubjectAggregateAnalysis;
          error?: string;
        };
        if (res.ok && data.ok && data.analysis) {
          dispatch({
            type: "SET_SUBJECT_ANALYSIS",
            subjectId,
            analysis: data.analysis,
            meta: {
              generatedAt: data.analysis.generatedAt,
              fingerprint,
              source: "openai",
            },
          });
          return data.analysis;
        }
        return applyHeuristic();
      } catch {
        return applyHeuristic();
      }
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

  const recordConceptReview = React.useCallback(
    (
      subjectId: string,
      documentId: string,
      conceptName: string,
      outcome: "correct" | "incorrect"
    ) => {
      if (!conceptName.trim()) return;
      dispatch({
        type: "RECORD_CONCEPT_REVIEW",
        subjectId,
        documentId,
        conceptName: conceptName.trim(),
        outcome,
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
      retryDocumentAnalysis,
      deleteDocument,
      renameDocument,
      selectDocument,
      addMistake,
      removeMistakeForQuestion,
      clearMistakes,
      loadSampleMistakes,
      saveExamPlan,
      refreshSubjectAnalysis,
      toggleDayCompleted,
      setPartialPlanProgress,
      recordConceptReview,
    }),
    [
      hydrated,
      state.subjects,
      getSubject,
      createSubject,
      deleteSubject,
      updateSubject,
      addDocumentFromFile,
      retryDocumentAnalysis,
      deleteDocument,
      renameDocument,
      selectDocument,
      addMistake,
      removeMistakeForQuestion,
      clearMistakes,
      loadSampleMistakes,
      saveExamPlan,
      refreshSubjectAnalysis,
      toggleDayCompleted,
      setPartialPlanProgress,
      recordConceptReview,
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
