import type { StudyDocument, SubjectWorkspace } from "@/data/types";
import { parseConceptReviewKey } from "@/lib/concept-review-catalog";

const EXTRACT_SINGLE = 56_000;
const EXTRACT_ALL_PER_DOC = 16_000;
const MAX_DOCS_ALL = 8;

export type StudyPracticeScope = "single" | "all";

/** Serializable bundle sent to /api/generate-study-practice. */
export type StudyPracticeBundle = {
  subjectName: string;
  documents: Array<{
    id: string;
    fileName: string;
    textSample: string;
    summary: null | {
      chapterOverview: string;
      keyConcepts: string[];
      likelyExamTopics: string[];
      confusingPoints: Array<{ title: string; note: string }>;
    };
  }>;
  mistakes: Array<{
    conceptTag: string;
    question: string;
    documentId: string;
  }>;
  weakestAreas: string[];
  topConcepts: string[];
  masteryWeakHints: Array<{
    documentId: string;
    fileName: string;
    conceptHint: string;
    incorrectCount: number;
    correctCount: number;
  }>;
};

export function buildStudyPracticeBundle(
  subject: SubjectWorkspace,
  scope: StudyPracticeScope,
  sourceDocumentId: string | null
): StudyPracticeBundle {
  const ready = subject.documents.filter(
    (d) =>
      d.status === "ready" &&
      d.parseSucceeded &&
      d.extractedText.trim().length > 0
  );

  let docs: StudyDocument[];
  if (scope === "single") {
    const one = sourceDocumentId
      ? ready.find((d) => d.id === sourceDocumentId)
      : ready[0];
    docs = one ? [one] : [];
  } else {
    docs = ready.slice(0, MAX_DOCS_ALL);
  }

  const documents = docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    textSample: d.extractedText.slice(
      0,
      scope === "single" ? EXTRACT_SINGLE : EXTRACT_ALL_PER_DOC
    ),
    summary: d.summary
      ? {
          chapterOverview: d.summary.chapterOverview.slice(0, 3500),
          keyConcepts: (d.summary.keyConcepts ?? []).slice(0, 12),
          likelyExamTopics: (d.summary.likelyExamTopics ?? []).slice(0, 12),
          confusingPoints: (d.summary.confusingPoints ?? [])
            .slice(0, 6)
            .map((cp) => ({
              title: cp.title,
              note: cp.note.slice(0, 400),
            })),
        }
      : null,
  }));

  const mistakes = subject.mistakes.slice(0, 40).map((m) => ({
    conceptTag: m.conceptTag,
    question: m.question.slice(0, 300),
    documentId: m.documentId,
  }));

  const weakestAreas = (subject.subjectAnalysis?.weakestAreas ?? []).slice(
    0,
    16
  );
  const topConcepts = (subject.subjectAnalysis?.topConcepts ?? []).slice(
    0,
    16
  );

  const masteryWeakHints: StudyPracticeBundle["masteryWeakHints"] = [];
  const book = subject.conceptReviewByKey ?? {};
  const docById = new Map(subject.documents.map((d) => [d.id, d]));

  for (const [key, prog] of Object.entries(book)) {
    if (prog.incorrectCount <= prog.correctCount) continue;
    const parsed = parseConceptReviewKey(key);
    if (!parsed) continue;
    const doc = docById.get(parsed.documentId);
    masteryWeakHints.push({
      documentId: parsed.documentId,
      fileName: doc?.fileName ?? "document",
      conceptHint: parsed.normalized.replace(/\s+/g, " "),
      incorrectCount: prog.incorrectCount,
      correctCount: prog.correctCount,
    });
  }
  masteryWeakHints.sort((a, b) => b.incorrectCount - a.incorrectCount);
  masteryWeakHints.splice(20);

  return {
    subjectName: subject.name,
    documents,
    mistakes,
    weakestAreas,
    topConcepts,
    masteryWeakHints,
  };
}
