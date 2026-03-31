/** Cap stored extracted text for localStorage quotas (full text still used before save). */
export const MAX_EXTRACTED_TEXT_STORED = 350_000;

export const TEXT_PREVIEW_LENGTH = 900;

/**
 * Fewer characters than this after PDF parse → treat as low-quality extract (likely
 * scanned/image PDF) and skip OpenAI summary to save cost; still build heuristic quiz.
 */
export const MIN_EXTRACT_MEANINGFUL_CHARS = 80;
