import type {
  CourseSummary,
  MistakeRecord,
  SubjectAggregateAnalysis,
  StudyDocument,
} from "@/data/types";

/** Fingerprint of documents that contributed structured summaries (order-independent). */
export function subjectSummaryFingerprint(documents: StudyDocument[]): string {
  return documents
    .filter((d) => d.status === "ready" && d.summary)
    .map((d) => d.id)
    .sort()
    .join("|");
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniquePush(list: string[], item: string, seen: Set<string>) {
  const n = norm(item);
  if (!n || seen.has(n)) return;
  seen.add(n);
  list.push(item.trim());
}

function countOccurrences(
  texts: string[],
  max = 40
): { text: string; count: number }[] {
  const map = new Map<string, { text: string; count: number }>();
  for (const raw of texts) {
    const t = raw.trim();
    if (!t) continue;
    const key = norm(t);
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { text: t, count: 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, max);
}

function quizConceptTags(quiz: StudyDocument["quiz"]): string[] {
  if (!quiz) return [];
  const tags: string[] = [];
  for (const q of quiz.multipleChoice) tags.push(q.conceptTag);
  for (const q of quiz.shortAnswer) tags.push(q.conceptTag);
  return tags;
}

/**
 * Rule-based subject merge when OpenAI is unavailable.
 * Uses only per-document summaries, quiz tags, and mistakes.
 */
export function buildHeuristicSubjectAggregate(
  subjectName: string,
  documents: StudyDocument[],
  mistakes: MistakeRecord[]
): SubjectAggregateAnalysis {
  const now = new Date().toISOString();
  const readyWithSummary = documents.filter(
    (d) => d.status === "ready" && d.summary
  );

  const overviews: string[] = [];
  const allKeyConcepts: string[] = [];
  const allExamTopics: string[] = [];
  const confusingTitles: string[] = [];
  const mistakeConcepts: string[] = [];

  for (const d of readyWithSummary) {
    const s = d.summary as CourseSummary;
    if (s.chapterOverview?.trim()) {
      overviews.push(
        `**${d.fileName}** — ${s.chapterOverview.trim()}`
      );
    }
    for (const c of s.keyConcepts ?? []) allKeyConcepts.push(c);
    for (const t of s.likelyExamTopics ?? []) allExamTopics.push(t);
    for (const cp of s.confusingPoints ?? []) {
      if (cp.title?.trim()) confusingTitles.push(cp.title.trim());
    }
  }

  for (const m of mistakes) {
    if (m.conceptTag?.trim()) mistakeConcepts.push(m.conceptTag.trim());
  }

  const topFromConcepts = countOccurrences(allKeyConcepts, 12).map((x) => x.text);
  const themes = countOccurrences(allExamTopics, 8)
    .filter((x) => x.count >= 2 && readyWithSummary.length > 1)
    .map((x) => x.text);

  const weakSeen = new Set<string>();
  const weakestAreas: string[] = [];
  for (const c of countOccurrences(mistakeConcepts, 12)) {
    uniquePush(weakestAreas, c.text, weakSeen);
  }
  for (const t of confusingTitles) {
    uniquePush(weakestAreas, t, weakSeen);
  }
  if (weakestAreas.length < 4) {
    for (const d of readyWithSummary) {
      const s = d.summary as CourseSummary;
      for (const cp of s.confusingPoints ?? []) {
        uniquePush(weakestAreas, cp.title, weakSeen);
        if (weakestAreas.length >= 12) break;
      }
      if (weakestAreas.length >= 12) break;
    }
  }

  const courseOverview =
    readyWithSummary.length === 0
      ? `No structured summaries yet for **${subjectName}**. Upload PDFs and wait for analysis to finish, then refresh course insights.`
      : [
          `Subject workspace: **${subjectName}** (${readyWithSummary.length} document${
            readyWithSummary.length === 1 ? "" : "s"
          } with summaries).`,
          "",
          ...overviews,
        ].join("\n\n");

  const quizTags: string[] = [];
  for (const d of documents) {
    for (const t of quizConceptTags(d.quiz)) quizTags.push(t);
  }
  const topConcepts =
    topFromConcepts.length > 0
      ? topFromConcepts
      : countOccurrences(quizTags, 8).map((x) => x.text);

  const mistakeByDoc = new Map<string, number>();
  for (const m of mistakes) {
    mistakeByDoc.set(m.documentId, (mistakeByDoc.get(m.documentId) ?? 0) + 1);
  }

  const recommendedRevisionOrder = [...documents]
    .filter((d) => d.status === "ready")
    .map((d) => {
      const s = d.summary;
      const confusionWeight = (s?.confusingPoints?.length ?? 0) * 2;
      const misses = mistakeByDoc.get(d.id) ?? 0;
      const hasSummary = s ? 1 : 0;
      return {
        d,
        score: misses * 3 + confusionWeight + (1 - hasSummary),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ d }) => ({
      documentId: d.id,
      fileName: d.fileName,
      rationale:
        (mistakeByDoc.get(d.id) ?? 0) > 0
          ? `Higher mistake count in quizzes for this file—prioritise refresher questions.`
          : (d.summary?.confusingPoints?.length ?? 0) > 0
            ? `Contains flagged confusing points—worth an extra read-through early.`
            : `Solid candidate for spaced repetition alongside weaker chapters.`,
    }));

  return {
    courseOverview,
    topConcepts:
      topConcepts.length > 0
        ? topConcepts
        : ["Add PDFs with successful AI summaries to see ranked concepts."],
    repeatedThemes:
      themes.length > 0
        ? themes
        : readyWithSummary.length > 1
          ? ["Themes will appear when the same exam topics show up across multiple documents."]
          : ["Upload a second PDF to surface cross-document themes."],
    weakestAreas:
      weakestAreas.length > 0
        ? weakestAreas.slice(0, 12)
        : ["Take quizzes and log mistakes to populate personalised weak areas."],
    recommendedRevisionOrder,
    generatedAt: now,
  };
}
