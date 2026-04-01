import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type {
  DailyPlanDay,
  ExamConfig,
  MistakeRecord,
  SubjectAggregateAnalysis,
  StudyDocument,
} from "@/data/types";
import {
  formatPlanDayLabel,
  parseLocalDateOnly,
  toLocalDateKey,
} from "@/lib/dates";
import {
  applyExamSprintOverlay,
  buildHeuristicDailyPlan,
} from "@/lib/exam-plan-heuristic";
import {
  buildDocumentDigests,
  formatSubjectContextBlock,
  mistakesDigestForPlanning,
} from "@/lib/planning-payload";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "plan_exam" as const;

function logError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:plan-exam]", context, {
    stage: STAGE,
    ...extra,
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

type AiPlanDayJson = {
  tasks: string[];
  focusConcepts: string[];
  priorityTasks: Array<{ label: string; importance: "high" | "medium" | "low" }>;
  isSprintDay: boolean;
};

function isAiPlanDayJson(data: unknown): data is AiPlanDayJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.tasks) || !o.tasks.every((x) => typeof x === "string")) {
    return false;
  }
  if (
    !Array.isArray(o.focusConcepts) ||
    !o.focusConcepts.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (!Array.isArray(o.priorityTasks)) return false;
  for (const p of o.priorityTasks) {
    if (!p || typeof p !== "object") return false;
    const r = p as Record<string, unknown>;
    if (typeof r.label !== "string") return false;
    if (r.importance !== "high" && r.importance !== "medium" && r.importance !== "low") {
      return false;
    }
  }
  if (typeof o.isSprintDay !== "boolean") return false;
  return true;
}

function buildDateRow(startIso: string, examIso: string, maxDays: number): string[] {
  const dates: string[] = [];
  const end = parseLocalDateOnly(examIso);
  end.setHours(0, 0, 0, 0);
  const cursor = parseLocalDateOnly(startIso);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime() && dates.length < maxDays) {
    dates.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      exam?: ExamConfig;
      startDate?: string;
      documents?: StudyDocument[];
      mistakes?: MistakeRecord[];
      subjectAnalysis?: SubjectAggregateAnalysis | null;
      subjectName?: string;
    };
    try {
      body = await req.json();
    } catch (e) {
      logError("request_json", e);
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const exam = body.exam;
    if (
      !exam ||
      typeof exam.name !== "string" ||
      typeof exam.date !== "string" ||
      typeof exam.hoursPerDay !== "number"
    ) {
      return json(
        { ok: false, error: "Missing exam config (name, date, hoursPerDay)." },
        400
      );
    }

    const subjectName =
      typeof body.subjectName === "string" && body.subjectName.trim()
        ? body.subjectName.trim()
        : "Subject";

    const docsIn = Array.isArray(body.documents) ? body.documents : [];
    const mistakesIn = Array.isArray(body.mistakes) ? body.mistakes : [];
    const subjectAnalysis =
      body.subjectAnalysis === undefined || body.subjectAnalysis === null
        ? null
        : body.subjectAnalysis;

    const startDate =
      typeof body.startDate === "string" && body.startDate.trim()
        ? body.startDate.trim()
        : toLocalDateKey(new Date());

    const dateKeys = buildDateRow(startDate, exam.date, 28);
    if (dateKeys.length === 0) {
      return json(
        { ok: false, error: "Exam date must be on or after the start date." },
        400
      );
    }

    const digests = buildDocumentDigests(docsIn);
    const mistakeDigest = mistakesDigestForPlanning(mistakesIn);
    const context = formatSubjectContextBlock({
      subjectName,
      documents: digests,
      mistakes: mistakeDigest,
      subjectAnalysis,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      const dailyPlan = applyExamSprintOverlay(
        buildHeuristicDailyPlan({
          examDateIso: exam.date,
          hoursPerDay: exam.hoursPerDay,
          documents: docsIn,
          mistakes: mistakesIn,
          subjectAnalysis,
        }),
        exam.date
      );
      return json({
        ok: true,
        source: "heuristic",
        dailyPlan,
        reason: "OPENAI_API_KEY missing — returned deterministic plan from summaries.",
      });
    }

    const scheduleDescription = dateKeys
      .map((iso, i) => `${i + 1}. ${iso}`)
      .join("\n");

    const system = `You are an expert revision planner for university exams.
You receive ONLY compact JSON derived from document summaries, quiz concept tags, mistakes, and an optional subject-level synthesis — never raw PDFs.

Return ONLY a JSON object: { "days": [ ... ] } where the array has EXACTLY ${dateKeys.length} entries — one for each scheduled date in order.
Each entry must match:
{
  "tasks": string[] (3–5 specific, actionable tasks referencing real concepts/files from the data; no generic "study hard"),
  "focusConcepts": string[] (2–5 tags),
  "priorityTasks": [ { "label": string, "importance": "high"|"medium"|"low" } ] (3–5 items covering the tasks; at least one "high"),
  "isSprintDay": boolean (true for intense final recap days — typically when within 3 days of the exam)
}

Rules:
- Ground every task in the supplied JSON; name documents from fileName when helpful.
- Weight mistakes and weakestAreas heavily earlier in the schedule; lighten repetition once concepts stabilise.
- Near the exam, shift to mixed recall, timed practice, and mistake notebook review.
- Match the energetic budget implicitly to roughly ${exam.hoursPerDay} hours/day (do not output hours unless as a task hint like "45 min block").`;

    const userMessage = `SUBJECT: ${subjectName}
EXAM_DATE: ${exam.date}
HOURS_PER_DAY: ${exam.hoursPerDay}
LOCAL_DATES_IN_ORDER:
${scheduleDescription}

DATA (JSON):
${context}`;

    try {
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_PLAN_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        logError("model", "empty completion");
        throw new Error("Empty response from model.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch (e) {
        logError("model", e, { snippet: raw.slice(0, 200) });
        throw new Error("Model did not return valid JSON.");
      }

      const root = parsed as Record<string, unknown>;
      if (!root || !Array.isArray(root.days)) {
        throw new Error("Expected { days: array } from model.");
      }
      if (root.days.length !== dateKeys.length) {
        throw new Error(
          `Expected ${dateKeys.length} days, got ${root.days.length}.`
        );
      }

      const minutesBudget = Math.round(exam.hoursPerDay * 60);
      const dailyPlan: DailyPlanDay[] = [];

      for (let i = 0; i < dateKeys.length; i++) {
        const day = root.days[i];
        if (!isAiPlanDayJson(day)) {
          throw new Error(`Invalid day schema at index ${i}.`);
        }
        const date = dateKeys[i]!;
        const label = formatPlanDayLabel(parseLocalDateOnly(date));
        dailyPlan.push({
          date,
          label,
          tasks: day.tasks.map((t) => t.trim()).filter(Boolean),
          focusConcepts: day.focusConcepts.map((t) => t.trim()).filter(Boolean),
          minutesBudget,
          completed: false,
          isSprintDay: day.isSprintDay,
          priorityTasks: day.priorityTasks.map((p) => ({
            label: p.label.trim(),
            importance: p.importance,
          })),
        });
      }

      return json({
        ok: true,
        source: "ai",
        dailyPlan: applyExamSprintOverlay(dailyPlan, exam.date),
      });
    } catch (e) {
      logError("openai_or_validation", e);
      const dailyPlan = applyExamSprintOverlay(
        buildHeuristicDailyPlan({
          examDateIso: exam.date,
          hoursPerDay: exam.hoursPerDay,
          documents: docsIn,
          mistakes: mistakesIn,
          subjectAnalysis,
        }),
        exam.date
      );
      return json({
        ok: true,
        source: "heuristic",
        dailyPlan,
        reason:
          e instanceof Error ? e.message : "Planner fell back to heuristic plan.",
      });
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "unknown error");
    logError("fatal", e);
    return json({ ok: false, error: `Plan route failed: ${message}` }, 500);
  }
}
