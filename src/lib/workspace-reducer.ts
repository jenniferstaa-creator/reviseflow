import type {
  AppState,
  DailyPlanDay,
  ExamConfig,
  MistakeRecord,
  MockPracticePaper,
  MockPracticeQuestion,
  StudyPracticeQuestion,
  StudyPracticeSet,
  SubjectAccent,
  SubjectAggregateAnalysis,
  SubjectAnalysisMeta,
  SubjectIconId,
  SubjectWorkspace,
  StudyDocument,
} from "@/data/types";
import {
  advanceConceptReview,
  defaultConceptReviewProgress,
  makeConceptReviewKey,
  pruneConceptReviewKeysForDocument,
} from "@/lib/concept-review-catalog";
export type WorkspaceAction =
  | { type: "HYDRATE"; payload: AppState }
  | {
      type: "CREATE_SUBJECT";
      payload: {
        id: string;
        name: string;
        examDate?: string;
        accent: SubjectAccent;
        icon: SubjectIconId;
      };
    }
  | { type: "DELETE_SUBJECT"; subjectId: string }
  | {
      type: "UPDATE_SUBJECT";
      subjectId: string;
      patch: Partial<
        Pick<SubjectWorkspace, "name" | "examDate" | "accent" | "icon">
      >;
    }
  | { type: "ADD_DOCUMENT"; subjectId: string; doc: StudyDocument }
  | {
      type: "UPDATE_DOCUMENT";
      subjectId: string;
      docId: string;
      patch: Partial<StudyDocument>;
    }
  | { type: "DELETE_DOCUMENT"; subjectId: string; docId: string }
  | { type: "SELECT_DOCUMENT"; subjectId: string; docId: string | null }
  | { type: "ADD_MISTAKE"; subjectId: string; mistake: MistakeRecord }
  | {
      type: "REMOVE_MISTAKE_FOR_QUESTION";
      subjectId: string;
      documentId: string;
      questionId: string;
    }
  | { type: "CLEAR_MISTAKES"; subjectId: string }
  | { type: "SET_MISTAKES"; subjectId: string; mistakes: MistakeRecord[] }
  | {
      type: "SAVE_EXAM_PLAN";
      subjectId: string;
      exam: ExamConfig;
      dailyPlan: DailyPlanDay[];
    }
  | { type: "TOGGLE_PLAN_DAY"; subjectId: string; date: string }
  | {
      type: "SET_PARTIAL_PLAN";
      subjectId: string;
      completedDayCount: number;
    }
  | {
      type: "SET_SUBJECT_ANALYSIS";
      subjectId: string;
      analysis: SubjectAggregateAnalysis | null;
      meta: SubjectAnalysisMeta | null;
    }
  | {
      type: "RECORD_CONCEPT_REVIEW";
      subjectId: string;
      documentId: string;
      conceptName: string;
      outcome: "correct" | "incorrect";
    }
  | { type: "ADD_MOCK_PRACTICE_PAPER"; subjectId: string; paper: MockPracticePaper }
  | {
      type: "UPDATE_MOCK_PRACTICE_PAPER";
      subjectId: string;
      paperId: string;
      patch: Partial<MockPracticePaper>;
    }
  | { type: "DELETE_MOCK_PRACTICE_PAPER"; subjectId: string; paperId: string }
  | {
      type: "UPDATE_MOCK_PRACTICE_QUESTION";
      subjectId: string;
      paperId: string;
      questionId: string;
      patch: Partial<MockPracticeQuestion>;
    }
  | { type: "ADD_STUDY_PRACTICE_SET"; subjectId: string; set: StudyPracticeSet }
  | { type: "DELETE_STUDY_PRACTICE_SET"; subjectId: string; setId: string }
  | {
      type: "UPDATE_STUDY_PRACTICE_QUESTION";
      subjectId: string;
      setId: string;
      questionId: string;
      patch: Partial<StudyPracticeQuestion>;
    };

function touch(now: string): Pick<SubjectWorkspace, "updatedAt"> {
  return { updatedAt: now };
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function workspaceReducer(
  state: AppState,
  action: WorkspaceAction
): AppState {
  const now = new Date().toISOString();

  switch (action.type) {
    case "HYDRATE":
      return action.payload;

    case "CREATE_SUBJECT": {
      const subject: SubjectWorkspace = {
        id: action.payload.id,
        name: action.payload.name.trim() || "Untitled subject",
        examDate: action.payload.examDate?.trim() || undefined,
        accent: action.payload.accent,
        icon: action.payload.icon,
        createdAt: now,
        updatedAt: now,
        documents: [],
        selectedDocumentId: null,
        mistakes: [],
        exam: null,
        dailyPlan: [],
        subjectAnalysis: null,
        subjectAnalysisMeta: null,
        conceptReviewByKey: {},
        mockPracticePapers: [],
        studyPracticeSets: [],
      };
      return { ...state, subjects: [...state.subjects, subject] };
    }

    case "DELETE_SUBJECT": {
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.subjectId),
      };
    }

    case "UPDATE_SUBJECT": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...action.patch,
                updatedAt: now,
              }
            : s
        ),
      };
    }

    case "ADD_DOCUMENT": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                documents: [...s.documents, action.doc],
                updatedAt: now,
              }
            : s
        ),
      };
    }

    case "UPDATE_DOCUMENT": {
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          return {
            ...s,
            ...touch(now),
            documents: s.documents.map((d) =>
              d.id === action.docId ? { ...d, ...action.patch } : d
            ),
          };
        }),
      };
    }

    case "DELETE_DOCUMENT": {
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          const nextDocs = s.documents.filter((d) => d.id !== action.docId);
          const nextSel =
            s.selectedDocumentId === action.docId
              ? nextDocs[0]?.id ?? null
              : s.selectedDocumentId;
          return {
            ...s,
            ...touch(now),
            documents: nextDocs,
            selectedDocumentId: nextSel,
            mistakes: s.mistakes.filter((m) => m.documentId !== action.docId),
            conceptReviewByKey: pruneConceptReviewKeysForDocument(
              s.conceptReviewByKey ?? {},
              action.docId
            ),
          };
        }),
      };
    }

    case "SELECT_DOCUMENT": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? { ...s, ...touch(now), selectedDocumentId: action.docId }
            : s
        ),
      };
    }

    case "ADD_MISTAKE": {
      const m = action.mistake;
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          const existingIdx = s.mistakes.findIndex(
            (x) =>
              x.questionId === m.questionId && x.documentId === m.documentId
          );
          if (existingIdx >= 0) {
            const prev = s.mistakes[existingIdx];
            const updated: MistakeRecord = {
              ...m,
              id: prev.id,
              createdAt: new Date().toISOString(),
            };
            const rest = s.mistakes.filter((_, i) => i !== existingIdx);
            return { ...s, ...touch(now), mistakes: [updated, ...rest] };
          }
          return {
            ...s,
            ...touch(now),
            mistakes: [m, ...s.mistakes],
          };
        }),
      };
    }

    case "REMOVE_MISTAKE_FOR_QUESTION": {
      const { subjectId, documentId, questionId } = action;
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            ...touch(now),
            mistakes: s.mistakes.filter(
              (x) =>
                !(x.documentId === documentId && x.questionId === questionId)
            ),
          };
        }),
      };
    }

    case "CLEAR_MISTAKES": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? { ...s, ...touch(now), mistakes: [] }
            : s
        ),
      };
    }

    case "SET_MISTAKES": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? { ...s, ...touch(now), mistakes: action.mistakes }
            : s
        ),
      };
    }

    case "SAVE_EXAM_PLAN": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                exam: action.exam,
                dailyPlan: action.dailyPlan,
              }
            : s
        ),
      };
    }

    case "TOGGLE_PLAN_DAY": {
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          return {
            ...s,
            ...touch(now),
            dailyPlan: s.dailyPlan.map((d) =>
              d.date === action.date
                ? { ...d, completed: !d.completed }
                : d
            ),
          };
        }),
      };
    }

    case "SET_PARTIAL_PLAN": {
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          return {
            ...s,
            ...touch(now),
            dailyPlan: s.dailyPlan.map((d, idx) => ({
              ...d,
              completed: idx < action.completedDayCount,
            })),
          };
        }),
      };
    }

    case "SET_SUBJECT_ANALYSIS": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                subjectAnalysis: action.analysis,
                subjectAnalysisMeta: action.meta,
              }
            : s
        ),
      };
    }

    case "RECORD_CONCEPT_REVIEW": {
      const clock = new Date();
      const key = makeConceptReviewKey(
        action.documentId,
        action.conceptName
      );
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          const book = { ...(s.conceptReviewByKey ?? {}) };
          const prev = book[key] ?? defaultConceptReviewProgress(clock);
          book[key] = advanceConceptReview(prev, action.outcome, clock);
          return {
            ...s,
            ...touch(now),
            conceptReviewByKey: book,
          };
        }),
      };
    }

    case "ADD_MOCK_PRACTICE_PAPER": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                mockPracticePapers: [
                  action.paper,
                  ...(s.mockPracticePapers ?? []),
                ],
              }
            : s
        ),
      };
    }

    case "UPDATE_MOCK_PRACTICE_PAPER": {
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== action.subjectId) return s;
          return {
            ...s,
            ...touch(now),
            mockPracticePapers: (s.mockPracticePapers ?? []).map((p) =>
              p.id === action.paperId ? { ...p, ...action.patch } : p
            ),
          };
        }),
      };
    }

    case "DELETE_MOCK_PRACTICE_PAPER": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                mockPracticePapers: (s.mockPracticePapers ?? []).filter(
                  (p) => p.id !== action.paperId
                ),
              }
            : s
        ),
      };
    }

    case "UPDATE_MOCK_PRACTICE_QUESTION": {
      const { subjectId, paperId, questionId, patch } = action;
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            ...touch(now),
            mockPracticePapers: (s.mockPracticePapers ?? []).map((p) => {
              if (p.id !== paperId) return p;
              return {
                ...p,
                questions: p.questions.map((q) =>
                  q.id === questionId ? { ...q, ...patch } : q
                ),
              };
            }),
          };
        }),
      };
    }

    case "ADD_STUDY_PRACTICE_SET": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                studyPracticeSets: [
                  action.set,
                  ...(s.studyPracticeSets ?? []),
                ],
              }
            : s
        ),
      };
    }

    case "DELETE_STUDY_PRACTICE_SET": {
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.subjectId
            ? {
                ...s,
                ...touch(now),
                studyPracticeSets: (s.studyPracticeSets ?? []).filter(
                  (x) => x.id !== action.setId
                ),
              }
            : s
        ),
      };
    }

    case "UPDATE_STUDY_PRACTICE_QUESTION": {
      const { subjectId, setId, questionId, patch } = action;
      return {
        ...state,
        subjects: state.subjects.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            ...touch(now),
            studyPracticeSets: (s.studyPracticeSets ?? []).map((st) => {
              if (st.id !== setId) return st;
              return {
                ...st,
                questions: st.questions.map((q) =>
                  q.id === questionId ? { ...q, ...patch } : q
                ),
              };
            }),
          };
        }),
      };
    }

    default:
      return state;
  }
}

export { newId };
