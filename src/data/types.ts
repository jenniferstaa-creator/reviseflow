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
  /** Subject scope (mirror of workspace id; optional for older localStorage rows). */
  subjectId?: string;
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

/** How study materials were produced (for migration + debugging). */
export type DocumentContentSource = "extracted" | "legacy-mock";

/** Where the structured summary came from. */
export type SummarySource = "openai" | "heuristic" | "legacy-mock";

/** Where the quiz question set came from. */
export type QuizSource = "openai" | "heuristic" | "legacy-mock";

/** Which pipeline step failed when `status === "error"` (or last fatal step). */
export type DocumentPipelineFailureStage =
  | "pdf_parse"
  | "empty_extract"
  | "unexpected";

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
  /** Raw text from PDF (may be truncated for localStorage — see textTruncated). */
  extractedText: string;
  /** Short plain-text preview for cards and debugging. */
  textPreview: string;
  pageCount: number | null;
  /** True once server-side PDF parsing returned usable text for this doc. */
  parseSucceeded: boolean;
  parseErrorMessage?: string;
  textTruncated?: boolean;
  /** Older saved workspaces may have mock SCM content without extraction. */
  contentSource?: DocumentContentSource;
  /** How the summary field was produced (new uploads use OpenAI when configured). */
  summarySource?: SummarySource;
  /** PDF text OK but AI summary failed; quiz may still exist. */
  summaryError?: string;
  /** How the quiz field was produced. */
  quizSource?: QuizSource;
  /** Set when OpenAI quiz failed and heuristic fallback was used (or other quiz issues). */
  quizError?: string;
  /**
   * When `status === "error"`, identifies the step. `unexpected` = uncaught error before/during AI.
   */
  pipelineFailureStage?: DocumentPipelineFailureStage;
  /** Raw or detailed message for debugging (HTTP body, stack message, etc.). */
  pipelineErrorDetail?: string;
  /** True when extract length is below MIN_EXTRACT_MEANINGFUL_CHARS but non-empty. */
  extractTooShort?: boolean;
  /** Character length of extract right after PDF parse (before storage cap). */
  extractLengthAtParse?: number;
  /** Last OpenAI request metadata (input size, truncation) for technical details. */
  lastAnalysisMeta?: {
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
