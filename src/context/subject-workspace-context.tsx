"use client";

import * as React from "react";
import { notFound, useParams } from "next/navigation";
import type {
  ExamConfig,
  MistakeRecord,
  MockPracticeQuestion,
  StudyDocument,
  StudyPracticeQuestion,
  StudyPracticeSet,
  SubjectAnalysisMeta,
  SubjectAggregateAnalysis,
  SubjectWorkspace,
} from "@/data/types";
import { useWorkspace } from "@/context/workspace-context";
import { subjectSummaryFingerprint } from "@/lib/subject-insights";

export type SubjectWorkspaceContextValue = {
  subjectId: string;
  subject: SubjectWorkspace;
  documents: StudyDocument[];
  selectedDocumentId: string | null;
  selectedDocument: StudyDocument | null;
  mistakes: MistakeRecord[];
  exam: ExamConfig | null;
  dailyPlan: SubjectWorkspace["dailyPlan"];
  subjectAnalysis: SubjectAggregateAnalysis | null;
  subjectAnalysisMeta: SubjectAnalysisMeta | null;
  /** True when PDFs/summaries changed since the last subject-level analysis run. */
  subjectInsightsStale: boolean;
  studyCompletionPercent: number;
  revisionStreakDays: number;
  readyDocumentCount: number;
  selectDocument: (docId: string | null) => void;
  addDocumentFromFile: (file: File) => void;
  retryDocumentAnalysis: (docId: string) => void;
  deleteDocument: (docId: string) => void;
  renameDocument: (docId: string, fileName: string) => void;
  addMistake: (
    documentId: string,
    m: Omit<
      MistakeRecord,
      "id" | "createdAt" | "errorType" | "documentId" | "subjectId"
    > & {
      errorType?: MistakeRecord["errorType"];
    }
  ) => void;
  removeMistakeForQuestion: (documentId: string, questionId: string) => void;
  clearMistakes: () => void;
  loadSampleMistakes: () => void;
  saveExamPlan: (
    config: ExamConfig,
    opts?: { subjectAnalysis?: SubjectAggregateAnalysis | null }
  ) => Promise<void>;
  refreshSubjectAnalysis: () => Promise<SubjectAggregateAnalysis | null>;
  toggleDayCompleted: (date: string) => void;
  setPartialPlanProgress: (completedDayCount: number) => void;
  recordConceptReview: (
    documentId: string,
    conceptName: string,
    outcome: "correct" | "incorrect"
  ) => void;
  addMockPracticePaperFromFile: (file: File) => void;
  deleteMockPracticePaper: (paperId: string) => void;
  updateMockPracticeQuestion: (
    paperId: string,
    questionId: string,
    patch: Partial<MockPracticeQuestion>
  ) => void;
  addStudyPracticeSet: (set: StudyPracticeSet) => void;
  deleteStudyPracticeSet: (setId: string) => void;
  updateStudyPracticeQuestion: (
    setId: string,
    questionId: string,
    patch: Partial<StudyPracticeQuestion>
  ) => void;
};

const SubjectWorkspaceContext =
  React.createContext<SubjectWorkspaceContextValue | null>(null);

function SubjectWorkspaceInner({
  subjectId,
  children,
}: {
  subjectId: string;
  children: React.ReactNode;
}) {
  const ws = useWorkspace();
  const subject = ws.getSubject(subjectId);
  const selectDocumentFn = ws.selectDocument;

  React.useEffect(() => {
    if (!ws.hydrated || !subject) return;
    const ready = subject.documents.filter((d) => d.status === "ready");
    if (!subject.selectedDocumentId && ready.length === 1) {
      selectDocumentFn(subjectId, ready[0].id);
    }
  }, [
    ws.hydrated,
    subject,
    subjectId,
    selectDocumentFn,
  ]);

  if (!ws.hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (!subject) {
    notFound();
  }

  const selectedDocument = subject.selectedDocumentId
    ? subject.documents.find((d) => d.id === subject.selectedDocumentId) ?? null
    : null;

  const studyCompletionPercent =
    subject.dailyPlan.length === 0
      ? 0
      : Math.round(
          (subject.dailyPlan.filter((d) => d.completed).length /
            subject.dailyPlan.length) *
            100
        );

  const readyDocumentCount = subject.documents.filter(
    (d) => d.status === "ready"
  ).length;

  const fingerprint = subjectSummaryFingerprint(subject.documents);
  const subjectInsightsStale = Boolean(
    subject.subjectAnalysisMeta &&
      fingerprint !== subject.subjectAnalysisMeta.fingerprint
  );

  const value: SubjectWorkspaceContextValue = {
    subjectId,
    subject,
    documents: subject.documents,
    selectedDocumentId: subject.selectedDocumentId,
    selectedDocument,
    mistakes: subject.mistakes,
    exam: subject.exam,
    dailyPlan: subject.dailyPlan,
    subjectAnalysis: subject.subjectAnalysis,
    subjectAnalysisMeta: subject.subjectAnalysisMeta,
    subjectInsightsStale,
    studyCompletionPercent,
    revisionStreakDays: 5,
    readyDocumentCount,
    selectDocument: (docId) => ws.selectDocument(subjectId, docId),
    addDocumentFromFile: (file) => ws.addDocumentFromFile(subjectId, file),
    retryDocumentAnalysis: (docId) =>
      ws.retryDocumentAnalysis(subjectId, docId),
    deleteDocument: (docId) => ws.deleteDocument(subjectId, docId),
    renameDocument: (docId, fileName) =>
      ws.renameDocument(subjectId, docId, fileName),
    addMistake: (documentId, m) => ws.addMistake(subjectId, documentId, m),
    removeMistakeForQuestion: (documentId, questionId) =>
      ws.removeMistakeForQuestion(subjectId, documentId, questionId),
    clearMistakes: () => ws.clearMistakes(subjectId),
    loadSampleMistakes: () => ws.loadSampleMistakes(subjectId),
    saveExamPlan: (config, opts) =>
      ws.saveExamPlan(subjectId, config, opts),
    refreshSubjectAnalysis: () => ws.refreshSubjectAnalysis(subjectId),
    toggleDayCompleted: (date) => ws.toggleDayCompleted(subjectId, date),
    setPartialPlanProgress: (n) => ws.setPartialPlanProgress(subjectId, n),
    recordConceptReview: (documentId, conceptName, outcome) =>
      ws.recordConceptReview(subjectId, documentId, conceptName, outcome),
    addMockPracticePaperFromFile: (file) =>
      ws.addMockPracticePaperFromFile(subjectId, file),
    deleteMockPracticePaper: (paperId) =>
      ws.deleteMockPracticePaper(subjectId, paperId),
    updateMockPracticeQuestion: (paperId, questionId, patch) =>
      ws.updateMockPracticeQuestion(subjectId, paperId, questionId, patch),
    addStudyPracticeSet: (set) =>
      ws.addStudyPracticeSet(subjectId, set),
    deleteStudyPracticeSet: (setId) =>
      ws.deleteStudyPracticeSet(subjectId, setId),
    updateStudyPracticeQuestion: (setId, questionId, patch) =>
      ws.updateStudyPracticeQuestion(subjectId, setId, questionId, patch),
  };

  return (
    <SubjectWorkspaceContext.Provider value={value}>
      {children}
    </SubjectWorkspaceContext.Provider>
  );
}

export function SubjectWorkspaceBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ subjectId: string }>();
  const subjectId = params.subjectId;

  if (!subjectId || typeof subjectId !== "string") {
    notFound();
  }

  return (
    <SubjectWorkspaceInner subjectId={subjectId}>{children}</SubjectWorkspaceInner>
  );
}

export function useSubjectWorkspace() {
  const ctx = React.useContext(SubjectWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useSubjectWorkspace must be used within a subject workspace"
    );
  }
  return ctx;
}
