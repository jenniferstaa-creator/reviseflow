import type {
  CourseSummary,
  MistakeRecord,
  SubjectAggregateAnalysis,
  StudyDocument,
} from "@/data/types";

const MAX_OVERVIEW_PER_DOC = 2200;
const MAX_CONCEPTS_PER_DOC = 8;
const MAX_TOPICS_PER_DOC = 6;
const MAX_CONFUSING_PER_DOC = 4;
const MAX_MISTAKES = 24;
const MAX_TOTAL_CHARS = 32000;

export type DocumentDigestForPlanning = {
  documentId: string;
  fileName: string;
  summary: Pick<
    CourseSummary,
    | "chapterOverview"
    | "keyConcepts"
    | "likelyExamTopics"
    | "confusingPoints"
  >;
  quizConceptTags: string[];
};

export function buildDocumentDigests(
  documents: StudyDocument[]
): DocumentDigestForPlanning[] {
  const out: DocumentDigestForPlanning[] = [];
  for (const d of documents) {
    if (d.status !== "ready" || !d.summary) continue;
    const s = d.summary;
    const tags = new Set<string>();
    if (d.quiz) {
      for (const q of d.quiz.multipleChoice) tags.add(q.conceptTag);
      for (const q of d.quiz.shortAnswer) tags.add(q.conceptTag);
    }
    out.push({
      documentId: d.id,
      fileName: d.fileName,
      summary: {
        chapterOverview: s.chapterOverview.slice(0, MAX_OVERVIEW_PER_DOC),
        keyConcepts: (s.keyConcepts ?? []).slice(0, MAX_CONCEPTS_PER_DOC),
        likelyExamTopics: (s.likelyExamTopics ?? []).slice(0, MAX_TOPICS_PER_DOC),
        confusingPoints: (s.confusingPoints ?? []).slice(0, MAX_CONFUSING_PER_DOC),
      },
      quizConceptTags: [...tags].slice(0, 20),
    });
  }
  return out;
}

export function trimPlanningJson(text: string): string {
  if (text.length <= MAX_TOTAL_CHARS) return text;
  return `${text.slice(0, MAX_TOTAL_CHARS)}\n\n[TRUNCATED_FOR_MODEL]`;
}

export function mistakesDigestForPlanning(
  mistakes: MistakeRecord[]
): Array<{ conceptTag: string; question: string; documentId: string }> {
  return mistakes.slice(0, MAX_MISTAKES).map((m) => ({
    conceptTag: m.conceptTag,
    question: m.question.slice(0, 280),
    documentId: m.documentId,
  }));
}

export function formatSubjectContextBlock(input: {
  subjectName: string;
  documents: DocumentDigestForPlanning[];
  mistakes: ReturnType<typeof mistakesDigestForPlanning>;
  subjectAnalysis: SubjectAggregateAnalysis | null | undefined;
}): string {
  const { subjectName, documents, mistakes, subjectAnalysis } = input;
  const payload = {
    subjectName,
    documents,
    mistakes,
    existingSubjectAnalysis: subjectAnalysis
      ? {
          courseOverview: subjectAnalysis.courseOverview.slice(0, 4000),
          topConcepts: subjectAnalysis.topConcepts.slice(0, 16),
          repeatedThemes: subjectAnalysis.repeatedThemes.slice(0, 12),
          weakestAreas: subjectAnalysis.weakestAreas.slice(0, 12),
          recommendedRevisionOrder: subjectAnalysis.recommendedRevisionOrder,
        }
      : null,
  };
  return trimPlanningJson(JSON.stringify(payload, null, 0));
}
