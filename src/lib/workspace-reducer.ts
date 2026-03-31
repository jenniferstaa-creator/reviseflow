import type {
  AppState,
  DailyPlanDay,
  ExamConfig,
  MistakeRecord,
  SubjectAccent,
  SubjectIconId,
  SubjectWorkspace,
  StudyDocument,
} from "@/data/types";
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
          if (
            s.mistakes.some(
              (x) =>
                x.questionId === m.questionId && x.documentId === m.documentId
            )
          ) {
            return { ...s, ...touch(now) };
          }
          return {
            ...s,
            ...touch(now),
            mistakes: [m, ...s.mistakes],
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

    default:
      return state;
  }
}

export { newId };
