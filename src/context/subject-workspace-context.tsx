"use client";

import * as React from "react";
import { notFound, useParams } from "next/navigation";
import type {
  ExamConfig,
  MistakeRecord,
  StudyDocument,
  SubjectWorkspace,
} from "@/data/types";
import { useWorkspace } from "@/context/workspace-context";

export type SubjectWorkspaceContextValue = {
  subjectId: string;
  subject: SubjectWorkspace;
  documents: StudyDocument[];
  selectedDocumentId: string | null;
  selectedDocument: StudyDocument | null;
  mistakes: MistakeRecord[];
  exam: ExamConfig | null;
  dailyPlan: SubjectWorkspace["dailyPlan"];
  studyCompletionPercent: number;
  revisionStreakDays: number;
  readyDocumentCount: number;
  selectDocument: (docId: string | null) => void;
  addDocumentFromFile: (file: File) => void;
  retryDocumentAnalysis: (docId: string) => void;
  deleteDocument: (docId: string) => void;
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
  saveExamPlan: (config: ExamConfig) => void;
  toggleDayCompleted: (date: string) => void;
  setPartialPlanProgress: (completedDayCount: number) => void;
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

  const value: SubjectWorkspaceContextValue = {
    subjectId,
    subject,
    documents: subject.documents,
    selectedDocumentId: subject.selectedDocumentId,
    selectedDocument,
    mistakes: subject.mistakes,
    exam: subject.exam,
    dailyPlan: subject.dailyPlan,
    studyCompletionPercent,
    revisionStreakDays: 5,
    readyDocumentCount,
    selectDocument: (docId) => ws.selectDocument(subjectId, docId),
    addDocumentFromFile: (file) => ws.addDocumentFromFile(subjectId, file),
    retryDocumentAnalysis: (docId) =>
      ws.retryDocumentAnalysis(subjectId, docId),
    deleteDocument: (docId) => ws.deleteDocument(subjectId, docId),
    addMistake: (documentId, m) => ws.addMistake(subjectId, documentId, m),
    removeMistakeForQuestion: (documentId, questionId) =>
      ws.removeMistakeForQuestion(subjectId, documentId, questionId),
    clearMistakes: () => ws.clearMistakes(subjectId),
    loadSampleMistakes: () => ws.loadSampleMistakes(subjectId),
    saveExamPlan: (config) => ws.saveExamPlan(subjectId, config),
    toggleDayCompleted: (date) => ws.toggleDayCompleted(subjectId, date),
    setPartialPlanProgress: (n) => ws.setPartialPlanProgress(subjectId, n),
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
