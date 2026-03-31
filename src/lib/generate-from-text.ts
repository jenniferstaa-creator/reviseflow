import type { CourseSummary, QuizContent, QuizQuestionMCQ, QuizQuestionShort } from "@/data/types";

const STOP = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "has",
  "was",
  "were",
  "been",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "his",
  "they",
  "their",
  "which",
  "will",
  "would",
  "there",
  "about",
  "into",
  "than",
  "then",
  "them",
  "these",
  "those",
]);

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildTextPreview(text: string, maxLen: number): string {
  const n = normalizeWhitespace(text);
  if (n.length <= maxLen) return n;
  const slice = n.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.5 ? slice.slice(0, lastSpace) : slice) + "…";
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^/.]+$/, "").trim();
  return base || "Uploaded document";
}

function splitSentences(text: string): string[] {
  const n = normalizeWhitespace(text);
  if (!n) return [];
  const parts = n.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 0) return parts;
  return n.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 40);
}

function topKeywords(text: string, k: number): string[] {
  const words =
    text.toLowerCase().match(/\b[a-z]{4,}\b/g)?.filter((w) => !STOP.has(w)) ??
    [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([w]) => w);
}

function uniqueWords(minLen: number, text: string, exclude: Set<string>): string[] {
  const raw =
    text.match(new RegExp(`\\b[A-Za-z]{${minLen},}\\b`, "g")) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of raw) {
    const k = w.toLowerCase();
    if (exclude.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/**
 * Heuristic summary from extracted PDF text (no AI). Good enough to reflect document content.
 */
export function buildSummaryFromExtractedText(
  fileName: string,
  rawText: string,
  pageCount: number | null
): CourseSummary {
  const text = normalizeWhitespace(rawText);
  const displayTitle = titleFromFileName(fileName);
  const sentences = splitSentences(text);

  const chapterOverview =
    text.length === 0
      ? "No readable text could be extracted from this PDF."
      : text.length <= 1600
        ? text
        : `${text.slice(0, 1550).trim()}…`;

  const ranked = [...sentences]
    .filter((s) => s.length >= 45 && s.length <= 420)
    .sort((a, b) => b.length - a.length);

  const keyConcepts: string[] = [];
  const used = new Set<string>();
  for (const s of ranked) {
    if (keyConcepts.length >= 5) break;
    const k = s.slice(0, 180);
    if (!used.has(k)) {
      used.add(k);
      keyConcepts.push(s.length > 220 ? `${s.slice(0, 217)}…` : s);
    }
  }
  while (keyConcepts.length < 3 && sentences.length > keyConcepts.length) {
    const s = sentences[keyConcepts.length];
    if (!used.has(s)) keyConcepts.push(s.length > 220 ? `${s.slice(0, 217)}…` : s);
    else break;
  }
  if (keyConcepts.length === 0 && text.length > 0) {
    keyConcepts.push(text.slice(0, Math.min(280, text.length)));
  }

  const keywords = topKeywords(text, 8);
  const likelyExamTopics = keywords.slice(0, 5).map(
    (w) =>
      `Explain or describe how “${w}” is used or defined in the material, with reference to the surrounding arguments.`
  );
  while (likelyExamTopics.length < 3 && sentences.length > likelyExamTopics.length) {
    likelyExamTopics.push(
      `Paraphrase the main claim in: “${sentences[likelyExamTopics.length].slice(0, 160)}…”`
    );
  }

  const confusingPoints =
    ranked.length >= 2
      ? [
          {
            title: "Dense passage",
            note:
              ranked[0].length > 320
                ? `${ranked[0].slice(0, 300)}…`
                : ranked[0],
          },
          {
            title: "Secondary argument",
            note:
              ranked[1].length > 320
                ? `${ranked[1].slice(0, 300)}…`
                : ranked[1],
          },
        ]
      : text.length > 0
        ? [
            {
              title: "Working excerpt",
              note: buildTextPreview(text, 400),
            },
          ]
        : [];

  const seeds = keywords.slice(0, 3);
  const simplifiedExplanations = seeds.map((term) => ({
    term,
    explanation: `Recurring in your PDF (${pageCount ? `${pageCount} pages` : "multiple sections"}). Trace each mention and note how it connects to nearby definitions or examples.`,
  }));

  return {
    courseTitle: displayTitle,
    chapterOverview:
      pageCount != null
        ? `${chapterOverview}\n\n(Source: ${pageCount} page${pageCount === 1 ? "" : "s"} extracted as text.)`
        : chapterOverview,
    keyConcepts,
    likelyExamTopics,
    confusingPoints,
    simplifiedExplanations,
  };
}

/**
 * Placeholder quiz grounded in the same extracted text (cloze + short prompts).
 */
export function buildQuizFromExtractedText(
  rawText: string,
  docId: string
): QuizContent {
  const text = normalizeWhitespace(rawText);

  if (text.length < 50) {
    return {
      multipleChoice: [
        {
          id: `${docId}-mcq-fallback`,
          type: "mcq",
          question:
            "Extracted text from this PDF is very short, so auto-generated cloze questions are limited. Try a text-based PDF or split chapters into separate files.",
          options: [
            "I'll try another file",
            "I'll continue anyway",
            "I'll add OCR later",
            "Not sure",
          ],
          correctAnswer: "I'll try another file",
          explanation:
            "Longer extracts produce questions tied to real sentences from your material.",
          conceptTag: "Meta",
        },
      ],
      shortAnswer: [],
    };
  }

  const sentences = splitSentences(text).filter(
    (s) => s.length >= 50 && s.length < 500
  );

  const multipleChoice: QuizQuestionMCQ[] = [];
  const targets = [0, 1, 2, 3];
  const fallbackBody =
    sentences.length > 0 ? null : text.slice(0, Math.min(320, text.length));

  for (const ti of targets) {
    const sentence =
      sentences.length > 0
        ? sentences[(ti + Math.floor(sentences.length / 5)) % sentences.length]
        : (fallbackBody ?? text.slice(0, 200));

    const words = uniqueWords(4, sentence, STOP);
    let blank = words.find((w) => w.length >= 5 && w.length <= 16) ?? words[0] ?? "term";
    let mask = sentence;
    for (const cand of words.length ? words : [blank]) {
      const next = sentence.replace(
        new RegExp(`\\b${escapeRegExp(cand)}\\b`, "i"),
        "______"
      );
      if (next !== sentence) {
        blank = cand;
        mask = next;
        break;
      }
    }

    const pool = uniqueWords(5, text, new Set([blank.toLowerCase()]));
    const distractors = pool
      .filter((w) => w.toLowerCase() !== blank.toLowerCase())
      .slice(0, 6);

    const optionsSet = new Set<string>([blank]);
    let di = 0;
    while (optionsSet.size < 4 && di < distractors.length) {
      optionsSet.add(distractors[di++]);
    }
    while (optionsSet.size < 4) {
      optionsSet.add(`Option ${optionsSet.size + 1} (placeholder)`);
    }
    const options = shuffle([...optionsSet], `${docId}-mcq-${ti}`);

    multipleChoice.push({
      id: `${docId}-mcq-${ti + 1}`,
      type: "mcq",
      question: `Fill in the blank in this sentence from your document: "${mask}"`,
      options,
      correctAnswer: blank,
      explanation: `The missing word "${blank}" appears in the original passage; re-read that section in your PDF.`,
      conceptTag: blank,
    });
  }

  const shortAnswer: QuizQuestionShort[] = [];
  const shortSeeds = sentences.length >= 2 ? [sentences[0], sentences[Math.min(3, sentences.length - 1)]] : [text.slice(0, 300)];

  shortSeeds.forEach((passage, i) => {
    const excerpt = passage.length > 220 ? `${passage.slice(0, 217)}…` : passage;
    shortAnswer.push({
      id: `${docId}-sa-${i + 1}`,
      type: "short",
      question: `In your own words, summarize the main point of this excerpt from your document:\n\n"${excerpt}"`,
      correctAnswer:
        "Accept any coherent summary that captures the excerpt’s primary claim and at least one supporting detail.",
      explanation:
        "Compare your answer to the excerpt: check that you named the core idea and didn’t invent details not implied there.",
      conceptTag: "Reading comprehension",
    });
  });

  return { multipleChoice, shortAnswer };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
