import type { PracticeQuestionType } from "@/data/types";

export type ClassifiedPracticeQuestion = {
  questionType: PracticeQuestionType;
  prompt: string;
  options: string[];
};

function normText(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

/** Captures option body: (a) foo, B. foo, 1) foo */
function matchOptionBody(line: string): string | null {
  const m = line.trim().match(
    /^\s*(?:\([A-Za-z\d]+\)\s*|[A-Za-z][\.\)]\s*|\d+[\.\)]\s*)(.+)$/
  );
  if (!m) return null;
  const body = m[1].trim();
  return body.length > 0 && body.length < 900 ? body : null;
}

function looksLikeTfStem(s: string): boolean {
  const t = s.toLowerCase();
  if (/\btrue\s*\/\s*false\b/.test(t)) return true;
  if (/\b(false|true)\s*\/\s*(true|false)\b/.test(t)) return true;
  if (/\bsant\s*\/\s*falskt\b/.test(t)) return true;
  if (/\b(richtig|falsch)\b/.test(t) && t.length < 400) return true;
  return false;
}

function looksLikeMcqCue(s: string): boolean {
  const t = s.toLowerCase();
  if (/select\s+(one|the\s+correct)/.test(t)) return true;
  if (/choose\s+(one|the\s+correct|an?\s+answer)/.test(t)) return true;
  if (/which\s+of\s+the\s+following/.test(t)) return true;
  if (/välj\s+(ett|rätt|ett\s+alternativ)/.test(t)) return true;
  if (/vilket\s+påstående/.test(t)) return true;
  if (/\bmark\s+one\b/.test(t)) return true;
  return false;
}

function isTrueFalsePair(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[.\s]+$/g, "");
  const y = b.toLowerCase().replace(/[.\s]+$/g, "");
  const t =
    x === "true" ||
    x === "t" ||
    x.startsWith("true ") ||
    /^sant\b/.test(x);
  const f =
    y === "false" ||
    y === "f" ||
    y.startsWith("false ") ||
    /^falsk/.test(y);
  const t2 =
    y === "true" ||
    y === "t" ||
    y.startsWith("true ") ||
    /^sant\b/.test(y);
  const f2 =
    x === "false" ||
    x === "f" ||
    x.startsWith("false ") ||
    /^falsk/.test(x);
  return (t && f) || (t2 && f2);
}

function tryExtractTrailingOptions(
  lines: string[]
): { stemLines: string[]; options: string[] } | null {
  let firstOpt = -1;
  for (let i = 0; i < lines.length; i++) {
    const body = matchOptionBody(lines[i]);
    if (body) {
      firstOpt = i;
      break;
    }
  }
  if (firstOpt < 0) return null;

  const options: string[] = [];
  for (let i = firstOpt; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const body = matchOptionBody(lines[i]);
    if (!body) break;
    options.push(body);
  }

  if (options.length < 2) return null;

  const stemLines = lines.slice(0, firstOpt);
  const stem = stemLines.join("\n").trim();
  if (stem.length < 8) return null;

  return { stemLines, options };
}

function writtenSubtype(stem: string): "short_answer" | "essay" {
  const t = stem.trim();
  const words = t.split(/\s+/).length;
  const low = t.toLowerCase();
  if (
    /\b(discuss|critically|evaluate|compare\s+and\s+contrast|in\s+detail|extensively)\b/.test(
      low
    )
  ) {
    return "essay";
  }
  if (words > 90 || t.length > 550) return "essay";
  return "short_answer";
}

export function classifyPracticeQuestion(raw: string): ClassifiedPracticeQuestion {
  const full = normText(raw);
  if (!full.length) {
    return { questionType: "essay", prompt: raw, options: [] };
  }

  const lines = full.split("\n");
  const extracted = tryExtractTrailingOptions(lines);

  if (extracted) {
    const { stemLines, options } = extracted;
    const stem = stemLines.join("\n").trim();

    if (options.length === 2 && isTrueFalsePair(options[0], options[1])) {
      return {
        questionType: "true_false",
        prompt: stem,
        options: ["True", "False"],
      };
    }

    const hasCue = looksLikeMcqCue(stem) || looksLikeMcqCue(full);
    if (options.length >= 3 || hasCue) {
      return {
        questionType: "multiple_choice",
        prompt: stem,
        options,
      };
    }

    if (options.length === 2 && hasCue) {
      return {
        questionType: "multiple_choice",
        prompt: stem,
        options,
      };
    }
  }

  if (looksLikeTfStem(full)) {
    return {
      questionType: "true_false",
      prompt: full.replace(/\(?\s*True\s*\/\s*False\s*\)?/gi, "").trim() || full,
      options: ["True", "False"],
    };
  }

  const subtype = writtenSubtype(full);
  return {
    questionType: subtype,
    prompt: full,
    options: [],
  };
}

const VALID_TYPES: PracticeQuestionType[] = [
  "true_false",
  "multiple_choice",
  "short_answer",
  "essay",
];

export function normalizeAiQuestionShape(input: {
  prompt?: string;
  /** @deprecated use prompt */
  promptText?: string;
  questionType?: string | null;
  options?: string[] | null;
}): ClassifiedPracticeQuestion {
  const rawPrompt = (input.prompt ?? input.promptText ?? "").trim();
  const rawType = input.questionType?.trim().toLowerCase();
  let t: PracticeQuestionType | null = VALID_TYPES.includes(
    rawType as PracticeQuestionType
  )
    ? (rawType as PracticeQuestionType)
    : null;

  let options = (input.options ?? [])
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

  if (t === "true_false") {
    options = [];
  }

  if (t === "multiple_choice" && (options.length < 2 || options.length > 10)) {
    t = null;
    options = [];
  }

  if (!t) {
    return classifyPracticeQuestion(rawPrompt);
  }

  let prompt = rawPrompt;

  if (t === "true_false") {
    return {
      questionType: "true_false",
      prompt: prompt || rawPrompt,
      options: ["True", "False"],
    };
  }

  if (t === "multiple_choice") {
    return {
      questionType: "multiple_choice",
      prompt: prompt || rawPrompt,
      options,
    };
  }

  return {
    questionType: t,
    prompt,
    options: [],
  };
}

export function normalizeSelection(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Compare user selection to canonical correct label (MCQ option or True/False). */
export function selectionsRoughlyMatch(user: string, correct: string): boolean {
  const a = normalizeSelection(user);
  const b = normalizeSelection(correct);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.includes(a)) return true;
  if (b.length >= 5 && a.includes(b)) return true;
  return false;
}

/** Normalize model-provided correct answer into a canonical label, or null if invalid. */
export function canonCorrectAnswer(
  shaped: ClassifiedPracticeQuestion,
  raw: string | null | undefined
): string | null {
  if (shaped.questionType === "short_answer" || shaped.questionType === "essay") {
    return null;
  }
  if (raw == null || typeof raw !== "string") return null;
  const cs = raw.trim();
  if (!cs) return null;
  if (shaped.questionType === "true_false") {
    if (/^true\b/i.test(cs)) return "True";
    if (/^false\b/i.test(cs)) return "False";
    return null;
  }
  for (const o of shaped.options) {
    if (selectionsRoughlyMatch(cs, o)) return o;
  }
  return null;
}
