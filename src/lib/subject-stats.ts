import type {
  MistakeRecord,
  SubjectAggregateAnalysis,
  SubjectWorkspace,
} from "@/data/types";

function normTopic(s: string): string {
  return s.trim().toLowerCase();
}

export type SubjectCourseStats = {
  /** All uploaded PDF rows in the subject. */
  pdfCount: number;
  /** Documents that finished the pipeline successfully (ready to study). */
  analyzedReadyCount: number;
  /** Ready documents that have at least summary or quiz materials. */
  analyzedWithMaterialsCount: number;
  /** MCQ + short items across all documents that have a quiz. */
  totalQuizQuestions: number;
  totalMistakes: number;
  /** Distinct weak signals: mistake concept tags ∪ subject insight weak areas. */
  weakTopicCount: number;
};

/**
 * Aggregates revision-focused counts for the subject overview and headers.
 */
export function getSubjectCourseStats(
  subject: Pick<
    SubjectWorkspace,
    "documents" | "mistakes" | "subjectAnalysis"
  >
): SubjectCourseStats {
  const docs = subject.documents ?? [];
  const pdfCount = docs.length;
  const analyzedReadyCount = docs.filter((d) => d.status === "ready").length;
  const analyzedWithMaterialsCount = docs.filter(
    (d) =>
      d.status === "ready" && (Boolean(d.summary) || Boolean(d.quiz))
  ).length;

  let totalQuizQuestions = 0;
  for (const d of docs) {
    if (!d.quiz) continue;
    totalQuizQuestions +=
      d.quiz.multipleChoice.length + d.quiz.shortAnswer.length;
  }

  const totalMistakes = subject.mistakes?.length ?? 0;
  const seen = new Set<string>();
  for (const m of subject.mistakes ?? []) {
    const k = normTopic(m.conceptTag);
    if (k) seen.add(k);
  }
  const analysisWeak = subject.subjectAnalysis?.weakestAreas ?? [];
  for (const w of analysisWeak) {
    const k = normTopic(w);
    if (k) seen.add(k);
  }
  const weakTopicCount = seen.size;

  return {
    pdfCount,
    analyzedReadyCount,
    analyzedWithMaterialsCount,
    totalQuizQuestions,
    totalMistakes,
    weakTopicCount,
  };
}

export function weakTopicCountCombined(
  mistakes: MistakeRecord[],
  subjectAnalysis: SubjectAggregateAnalysis | null | undefined
): number {
  const seen = new Set<string>();
  for (const m of mistakes) {
    const k = normTopic(m.conceptTag);
    if (k) seen.add(k);
  }
  for (const w of subjectAnalysis?.weakestAreas ?? []) {
    const k = normTopic(w);
    if (k) seen.add(k);
  }
  return seen.size;
}
