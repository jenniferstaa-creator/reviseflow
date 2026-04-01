/**
 * Rule-based splitting when OpenAI is unavailable or as a fallback.
 */

const MIN_QUESTION_CHARS = 24;
const MAX_QUESTIONS = 40;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * Split exam-style plain text into candidate question blocks.
 */
export function heuristicExtractQuestionTexts(text: string): string[] {
  const cleaned = normalizeNewlines(text);
  if (!cleaned.length) return [];

  const numberedSplit = cleaned.split(
    /\n(?=\s*(?:\d+[\.\)]\s+|[Qq]?\s*\d+[\.\):\s]|\([ivx]+\)\s|\([a-z]\)\s))/
  );
  const trimmed = numberedSplit.map((s) => s.trim()).filter(Boolean);

  const good =
    trimmed.length >= 2
      ? trimmed.filter((s) => s.length >= MIN_QUESTION_CHARS)
      : [];

  if (good.length >= 2) {
    return good.slice(0, MAX_QUESTIONS);
  }

  const paras = cleaned
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_QUESTION_CHARS);

  if (paras.length >= 2) {
    return paras.slice(0, MAX_QUESTIONS);
  }

  const chunk = cleaned.slice(0, 24_000);
  return chunk.length ? [chunk] : [];
}

/** Max characters sent to the extract-questions model. */
export const MAX_MOCK_EXTRACT_INPUT_CHARS = 80_000;
