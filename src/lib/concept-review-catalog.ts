import type {
  ConceptReviewProgressState,
  MistakeRecord,
  SubjectWorkspace,
} from "@/data/types";

export type ConceptMasteryStatus =
  | "new"
  | "upcoming"
  | "learning"
  | "struggling"
  | "strong";

export type ConceptReviewPriority = "high" | "medium" | "low";

export type ConceptReviewOutcome = "correct" | "incorrect";

export interface ConceptCatalogItem {
  key: string;
  documentId: string;
  documentFileName: string;
  conceptName: string;
  /** True when row comes from course insights only (anchor doc shown). */
  fromSubjectInsight: boolean;
}

export interface ConceptReviewRow extends ConceptCatalogItem {
  progress: ConceptReviewProgressState;
  masteryStatus: ConceptMasteryStatus;
  priority: ConceptReviewPriority;
}

const KEY_SEP = "\u241e"; // symbol for record separator — unlikely in filenames

export function normalizeConceptName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function makeConceptReviewKey(
  documentId: string,
  conceptName: string
): string {
  return `${documentId}${KEY_SEP}${normalizeConceptName(conceptName)}`;
}

export function parseConceptReviewKey(key: string): {
  documentId: string;
  normalized: string;
} | null {
  const i = key.indexOf(KEY_SEP);
  if (i <= 0) return null;
  return {
    documentId: key.slice(0, i),
    normalized: key.slice(i + KEY_SEP.length),
  };
}

export function defaultConceptReviewProgress(
  now: Date = new Date()
): ConceptReviewProgressState {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  return {
    lastReviewedAt: null,
    nextReviewAt: next.toISOString(),
    intervalDays: 1,
    correctCount: 0,
    incorrectCount: 0,
  };
}

export function advanceConceptReview(
  prev: ConceptReviewProgressState,
  outcome: ConceptReviewOutcome,
  now: Date
): ConceptReviewProgressState {
  let intervalDays = prev.intervalDays;
  let correctCount = prev.correctCount;
  let incorrectCount = prev.incorrectCount;

  if (outcome === "correct") {
    correctCount += 1;
    intervalDays = Math.min(
      60,
      Math.max(1, Math.round(intervalDays * 1.85))
    );
  } else {
    incorrectCount += 1;
    intervalDays = Math.max(
      1,
      Math.min(7, Math.floor(intervalDays / 2) || 1)
    );
  }

  const next = new Date(now);
  next.setDate(next.getDate() + intervalDays);
  next.setHours(12, 0, 0, 0);

  return {
    lastReviewedAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
    intervalDays,
    correctCount,
    incorrectCount,
  };
}

function addConcept(
  set: Map<string, ConceptCatalogItem>,
  documentId: string,
  fileName: string,
  conceptName: string,
  fromSubjectInsight: boolean
) {
  const n = conceptName.trim();
  if (!n) return;
  const key = makeConceptReviewKey(documentId, n);
  const prev = set.get(key);
  if (prev) {
    if (fromSubjectInsight) prev.fromSubjectInsight = true;
    return;
  }
  set.set(key, {
    key,
    documentId,
    documentFileName: fileName,
    conceptName: n,
    fromSubjectInsight,
  });
}

/**
 * All concepts to track: summaries, quizzes, mistakes, subject weak areas.
 */
export function buildConceptCatalog(subject: SubjectWorkspace): ConceptCatalogItem[] {
  const map = new Map<string, ConceptCatalogItem>();
  const readyDocs = subject.documents.filter(
    (d) => d.status === "ready" && (d.summary || d.quiz)
  );
  const anchor =
    readyDocs[0] ??
    subject.documents.find((d) => d.status === "ready") ??
    null;

  for (const d of readyDocs) {
    const s = d.summary;
    if (s) {
      for (const c of s.keyConcepts ?? []) {
        addConcept(map, d.id, d.fileName, c, false);
      }
      for (const c of s.likelyExamTopics ?? []) {
        addConcept(map, d.id, d.fileName, c, false);
      }
      for (const cp of s.confusingPoints ?? []) {
        addConcept(map, d.id, d.fileName, cp.title, false);
      }
      for (const se of s.simplifiedExplanations ?? []) {
        addConcept(map, d.id, d.fileName, se.term, false);
      }
    }
    if (d.quiz) {
      for (const q of d.quiz.multipleChoice) {
        addConcept(map, d.id, d.fileName, q.conceptTag, false);
      }
      for (const q of d.quiz.shortAnswer) {
        addConcept(map, d.id, d.fileName, q.conceptTag, false);
      }
    }
  }

  for (const m of subject.mistakes) {
    const doc = subject.documents.find((x) => x.id === m.documentId);
    if (doc) {
      addConcept(map, doc.id, doc.fileName, m.conceptTag, false);
    }
  }

  const weak = subject.subjectAnalysis?.weakestAreas ?? [];
  if (weak.length && anchor) {
    for (const w of weak) {
      addConcept(map, anchor.id, anchor.fileName, w, true);
    }
  }

  return [...map.values()].sort((a, b) =>
    a.conceptName.localeCompare(b.conceptName, undefined, {
      sensitivity: "base",
    })
  );
}

function mistakeWeightForKey(
  key: string,
  mistakes: MistakeRecord[]
): number {
  const parsed = parseConceptReviewKey(key);
  if (!parsed) return 0;
  let w = 0;
  for (const m of mistakes) {
    if (m.documentId !== parsed.documentId) continue;
    if (normalizeConceptName(m.conceptTag) === parsed.normalized) w += 1;
  }
  return w;
}

function subjectWeakMatchesConcept(
  conceptName: string,
  subject: SubjectWorkspace
): boolean {
  const n = normalizeConceptName(conceptName);
  for (const w of subject.subjectAnalysis?.weakestAreas ?? []) {
    if (normalizeConceptName(w) === n) return true;
  }
  return false;
}

export function deriveMastery(
  row: ConceptCatalogItem,
  p: ConceptReviewProgressState,
  subject: SubjectWorkspace
): ConceptMasteryStatus {
  const mistakeW = mistakeWeightForKey(row.key, subject.mistakes);
  if (p.lastReviewedAt == null) {
    const next = new Date(p.nextReviewAt).getTime();
    const now = Date.now();
    if (next <= now) return "upcoming";
    return "new";
  }
  if (mistakeW > p.correctCount || p.incorrectCount > p.correctCount) {
    return "struggling";
  }
  if (
    p.correctCount >= 3 &&
    p.intervalDays >= 7 &&
    p.incorrectCount === 0
  ) {
    return "strong";
  }
  return "learning";
}

export function derivePriority(
  row: ConceptCatalogItem,
  p: ConceptReviewProgressState,
  now: Date,
  subject: SubjectWorkspace
): ConceptReviewPriority {
  const next = new Date(p.nextReviewAt);
  const mistakeW = mistakeWeightForKey(row.key, subject.mistakes);
  if (next.getTime() < now.getTime()) return "high";
  if (mistakeW > 0 || subjectWeakMatchesConcept(row.conceptName, subject)) {
    return "high";
  }
  if (p.incorrectCount > p.correctCount) return "high";
  const m = deriveMastery(row, p, subject);
  if (m === "strong" && next.getTime() > now.getTime() + 5 * 86_400_000) {
    return "low";
  }
  return "medium";
}

export function mergeConceptReviewRows(
  subject: SubjectWorkspace,
  now: Date = new Date()
): ConceptReviewRow[] {
  const catalog = buildConceptCatalog(subject);
  const byKey = subject.conceptReviewByKey ?? {};
  return catalog.map((item) => {
    const progress =
      byKey[item.key] ?? defaultConceptReviewProgress(now);
    return {
      ...item,
      progress,
      masteryStatus: deriveMastery(item, progress, subject),
      priority: derivePriority(item, progress, now, subject),
    };
  });
}

export function formatReviewIntervalLabel(days: number): string {
  if (days <= 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.round(days / 7)} wk`;
  return `${Math.round(days / 30)} mo`;
}

export function formatNextReviewLabel(iso: string, now: Date): string {
  const t = new Date(iso).getTime();
  const d = Math.round((t - now.getTime()) / 86_400_000);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `in ${d}d`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function countReviewsLastNDays(
  byKey: Record<string, ConceptReviewProgressState>,
  now: Date,
  days: number
): number {
  const cutoff = now.getTime() - days * 86_400_000;
  let n = 0;
  for (const p of Object.values(byKey)) {
    if (!p.lastReviewedAt) continue;
    if (new Date(p.lastReviewedAt).getTime() >= cutoff) n += 1;
  }
  return n;
}

export function pruneConceptReviewKeysForDocument(
  byKey: Record<string, ConceptReviewProgressState>,
  documentId: string
): Record<string, ConceptReviewProgressState> {
  const prefix = `${documentId}${KEY_SEP}`;
  return Object.fromEntries(
    Object.entries(byKey).filter(([k]) => !k.startsWith(prefix))
  );
}