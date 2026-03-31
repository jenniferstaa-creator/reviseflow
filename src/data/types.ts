export type UploadStatus =
  | "idle"
  | "uploading"
  | "analyzing"
  | "ready"
  | "error";

export type ErrorType =
  | "Concept misunderstanding"
  | "Memory weakness"
  | "Application issue"
  | "Careless mistake";

/** Accent token for subject cards (maps to Tailwind in UI). */
export type SubjectAccent =
  | "teal"
  | "indigo"
  | "violet"
  | "sky"
  | "rose"
  | "amber";

/** Lucide icon name subset for subjects. */
export type SubjectIconId =
  | "book-open"
  | "graduation-cap"
  | "library"
  | "microscope"
  | "brain"
  | "line-chart";

export interface CourseSummary {
  courseTitle: string;
  chapterOverview: string;
  keyConcepts: string[];
  likelyExamTopics: string[];
  confusingPoints: { title: string; note: string }[];
  simplifiedExplanations: { term: string; explanation: string }[];
}

export interface QuizQuestionMCQ {
  id: string;
  type: "mcq";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
}

export interface QuizQuestionShort {
  id: string;
  type: "short";
  question: string;
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
}

export type QuizQuestion = QuizQuestionMCQ | QuizQuestionShort;

export interface QuizContent {
  multipleChoice: QuizQuestionMCQ[];
  shortAnswer: QuizQuestionShort[];
}

export interface MistakeRecord {
  id: string;
  questionId: string;
  /** Source document when mistake came from quiz (for filtering / analytics). */
  documentId: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  errorType: ErrorType;
  createdAt: string;
}

export interface DailyPlanDay {
  date: string;
  label: string;
  tasks: string[];
  focusConcepts: string[];
  minutesBudget: number;
  completed: boolean;
}

export interface ExamConfig {
  name: string;
  date: string;
  hoursPerDay: number;
}

export interface SpacedRepetitionItem {
  id: string;
  conceptTag: string;
  nextReviewLabel: string;
  strength: number;
}

/** One uploaded PDF and its generated materials. */
export interface StudyDocument {
  id: string;
  subjectId: string;
  fileName: string;
  uploadedAt: string;
  status: UploadStatus;
  analysisStep: string | null;
  summary: CourseSummary | null;
  quiz: QuizContent | null;
  errorMessage?: string;
}

/**
 * All persisted state for one subject (course workspace).
 * TODO(DB): rows subject, document, mistake, study_plan per user.
 */
export interface SubjectWorkspace {
  id: string;
  name: string;
  /** Optional target exam date for this course (used in cards + planner default). */
  examDate?: string;
  accent: SubjectAccent;
  icon: SubjectIconId;
  createdAt: string;
  updatedAt: string;
  documents: StudyDocument[];
  /** Active document for summary / quiz tabs. */
  selectedDocumentId: string | null;
  mistakes: MistakeRecord[];
  exam: ExamConfig | null;
  dailyPlan: DailyPlanDay[];
}

/** Root app state persisted to localStorage. */
export interface AppState {
  version: 1;
  subjects: SubjectWorkspace[];
}
