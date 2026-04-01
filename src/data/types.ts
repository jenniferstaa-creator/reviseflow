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

export interface PlanPriorityTask {
  label: string;
  importance: "high" | "medium" | "low";
}

export interface DailyPlanDay {
  date: string;
  label: string;
  tasks: string[];
  focusConcepts: string[];
  minutesBudget: number;
  completed: boolean;
  /** Last days before the exam: tighter recap and mistake-focused work. */
  isSprintDay?: boolean;
  /** Ordered by importance for quick scanning in Today / planner. */
  priorityTasks?: PlanPriorityTask[];
}

export interface ExamConfig {
  name: string;
  date: string;
  hoursPerDay: number;
  /** Whether the schedule was built with OpenAI or rule-based fallback. */
  planSource?: "ai" | "heuristic";
  planGeneratedAt?: string;
}

/** Subject-level synthesis from all document summaries (no raw PDF text). */
export interface SubjectAggregateAnalysis {
  courseOverview: string;
  topConcepts: string[];
  repeatedThemes: string[];
  weakestAreas: string[];
  recommendedRevisionOrder: Array<{
    documentId: string;
    fileName: string;
    rationale: string;
  }>;
  generatedAt: string;
}

export interface SubjectAnalysisMeta {
  generatedAt: string;
  /** Sorted ready document ids with summaries when this was produced. */
  fingerprint: string;
  source: "openai" | "heuristic";
}

/** Persisted SM-lite state per concept × document (keyed in `conceptReviewByKey`). */
export interface ConceptReviewProgressState {
  lastReviewedAt: string | null;
  nextReviewAt: string;
  intervalDays: number;
  correctCount: number;
  incorrectCount: number;
}

/** Classifier output for written vs selection-based practice items. */
export type PracticeQuestionType =
  | "true_false"
  | "multiple_choice"
  | "short_answer"
  | "essay";

/**
 * Normalized fields shared by extracted and generated practice questions.
 * Prefer this over raw concatenated text for rendering and grading.
 */
export interface StructuredPracticeQuestion {
  questionType: PracticeQuestionType;
  /** Question stem (no separate option lines when `options` is populated). */
  prompt: string;
  /** MCQ labels; empty for written types; TF uses fixed True/False in UI. */
  options: string[];
  /**
   * Canonical correct response when known: "True"/"False", MCQ option text,
   * or a short key for written items. Null until marked scheme / model supplies it.
   */
  correctAnswer: string | null;
  /** Points/marks if given on the paper or by the generator; null if unknown. */
  marks: number | null;
  /** Human-readable origin (e.g. source PDF filename). */
  source: string;
}

/** One item from an uploaded past-paper / exam PDF (mock practice workspace). */
export interface MockPracticeQuestion extends StructuredPracticeQuestion {
  id: string;
  userAnswer: string;
  /** After AI grading: set for true_false / multiple_choice when user submitted. */
  selectionIsCorrect: boolean | null;
  /** Full model / rubric-style answer (may be longer than correctAnswer). */
  suggestedAnswer: string | null;
  keyPoints: string[];
  feedback: string | null;
  strongerPhrasing: string | null;
  markedDifficult: boolean;
  savedForLater: boolean;
  evaluatedAt: string | null;
}

/** Parsed past-paper upload for the subject’s Mock Practice area. */
export interface MockPracticePaper {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: UploadStatus;
  analysisStep: string | null;
  errorMessage?: string;
  extractedText: string;
  questions: MockPracticeQuestion[];
}

/** AI practice modes generated from uploaded study PDFs (not past papers). */
export type StudyPracticeMode =
  | "quick_check"
  | "exam_style"
  | "weak_area_drill";

/** One AI-generated question from course materials. */
export interface StudyPracticeQuestion extends StructuredPracticeQuestion {
  id: string;
  sourceDocumentId: string | null;
  suggestedAnswer: string;
  keyPoints: string[];
  userAnswer: string;
  /** For TF/MCQ: set when user checks or when correctAnswer matches. */
  selectionIsCorrect: boolean | null;
  revealedAnswer: boolean;
  revealedKeyPoints: boolean;
  feedback: string | null;
  strongerPhrasing: string | null;
  markedDifficult: boolean;
  savedForLater: boolean;
  evaluatedAt: string | null;
}

/** A generated session (single or all PDFs) kept for review. */
export interface StudyPracticeSet {
  id: string;
  createdAt: string;
  mode: StudyPracticeMode;
  scope: "single" | "all";
  sourceDocumentId: string | null;
  title: string;
  questions: StudyPracticeQuestion[];
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
  /** Cross-document insights; refresh when PDFs or summaries change. */
  subjectAnalysis: SubjectAggregateAnalysis | null;
  subjectAnalysisMeta: SubjectAnalysisMeta | null;
  /**
   * Spaced-repetition progress keyed by `makeConceptReviewKey(documentId, conceptName)`.
   */
  conceptReviewByKey: Record<string, ConceptReviewProgressState>;
  /** Exam-style practice from uploaded question PDFs (separate from quiz). */
  mockPracticePapers: MockPracticePaper[];
  /** AI-generated written practice from lecture/notes PDFs in this subject. */
  studyPracticeSets: StudyPracticeSet[];
}

/** Root app state persisted to localStorage. */
export interface AppState {
  version: 1;
  subjects: SubjectWorkspace[];
}
