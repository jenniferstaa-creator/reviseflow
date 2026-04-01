import type {
  DailyPlanDay,
  MistakeRecord,
  PlanPriorityTask,
  SubjectAggregateAnalysis,
  StudyDocument,
} from "@/data/types";
import {
  formatPlanDayLabel,
  parseLocalDateOnly,
  toLocalDateKey,
} from "@/lib/dates";

/** Align sprint flags with last three calendar days before the exam. */
export function applyExamSprintOverlay(
  days: DailyPlanDay[],
  examDateIso: string
): DailyPlanDay[] {
  const end = parseLocalDateOnly(examDateIso);
  end.setHours(0, 0, 0, 0);
  return days.map((d) => {
    const t = parseLocalDateOnly(d.date);
    t.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((end.getTime() - t.getTime()) / 86_400_000);
    const sprint = daysLeft <= 3 && daysLeft >= 0;
    return { ...d, isSprintDay: sprint };
  });
}

function collectFocusPool(
  analysis: SubjectAggregateAnalysis | null,
  docs: StudyDocument[],
  mistakes: MistakeRecord[]
): string[] {
  const pool: string[] = [];
  if (analysis?.topConcepts?.length) pool.push(...analysis.topConcepts.slice(0, 8));
  if (analysis?.weakestAreas?.length) pool.push(...analysis.weakestAreas.slice(0, 6));
  for (const m of mistakes) {
    if (m.conceptTag?.trim()) pool.push(m.conceptTag.trim());
  }
  for (const d of docs) {
    const s = d.summary;
    if (!s) continue;
    for (const c of s.keyConcepts ?? []) pool.push(c);
    for (const t of s.likelyExamTopics ?? []) pool.push(t);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pool) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 24) break;
  }
  return out;
}

function buildTasksForDay(opts: {
  dayIndex: number;
  focus: string[];
  fileNames: string[];
  sprint: boolean;
}): { tasks: string[]; priority: PlanPriorityTask[] } {
  const { dayIndex, focus, fileNames, sprint } = opts;
  const f1 = focus[0] ?? "core concepts from your materials";
  const f2 = focus[1] ?? f1;
  const f3 = focus[2] ?? f2;
  const docHint =
    fileNames.length > 0
      ? `Re-read summary cards for: ${fileNames.slice(0, 2).join(", ")}${
          fileNames.length > 2 ? ` (+${fileNames.length - 2} more)` : ""
        }.`
      : "Skim summaries for every ready document in this subject.";

  const baseTasks = sprint
    ? [
        `Sprint — 10-minute lightning recap: ${f1}, ${f2}.`,
        `Mistake pass: re-run the hardest quiz items tied to “${f1}”.`,
        docHint,
        "One timed mixed practice block (MCQ + short answer).",
      ]
    : [
        docHint,
        `Deep study block (40–55 min): ${f1} — explain it aloud without notes.`,
        `Practice: write 5 bullet points on ${f2} as if teaching a friend.`,
        `Light quiz or recall on ${f3}.`,
      ];

  const rotated =
    dayIndex % 3 === 1
      ? [
          baseTasks[1]!,
          baseTasks[0]!,
          ...baseTasks.slice(2),
        ]
      : dayIndex % 3 === 2
        ? [
            baseTasks[2]!,
            ...baseTasks.slice(0, 2),
            ...baseTasks.slice(3),
          ]
        : baseTasks;

  const priority: PlanPriorityTask[] = [
    { label: rotated[0]!, importance: "high" },
    { label: rotated[1] ?? rotated[0]!, importance: "medium" },
    ...(rotated[2]
      ? [{ label: rotated[2], importance: "medium" as const }]
      : []),
    ...(rotated[3]
      ? [{ label: rotated[3], importance: "low" as const }]
      : []),
  ];

  return { tasks: rotated, priority };
}

/**
 * Deterministic plan using summaries, subject analysis, and mistakes (no model).
 */
export function buildHeuristicDailyPlan(opts: {
  examDateIso: string;
  hoursPerDay: number;
  documents: StudyDocument[];
  mistakes: MistakeRecord[];
  subjectAnalysis: SubjectAggregateAnalysis | null;
}): DailyPlanDay[] {
  const { examDateIso, hoursPerDay, documents, mistakes, subjectAnalysis } =
    opts;

  const endDay = parseLocalDateOnly(examDateIso);
  endDay.setHours(0, 0, 0, 0);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const focusPool = collectFocusPool(subjectAnalysis, documents, mistakes);
  const readyNames = documents
    .filter((d) => d.status === "ready")
    .map((d) => d.fileName);

  const revisionOrder = subjectAnalysis?.recommendedRevisionOrder ?? [];
  const orderedNames = revisionOrder.length
    ? revisionOrder.map((r) => r.fileName)
    : readyNames;

  const days: DailyPlanDay[] = [];
  let i = 0;
  while (cursor.getTime() <= endDay.getTime() && days.length < 28) {
    const iso = toLocalDateKey(cursor);
    const label = formatPlanDayLabel(cursor);

    const daysLeft = Math.round(
      (endDay.getTime() - cursor.getTime()) / 86_400_000
    );
    const sprint = daysLeft <= 3 && daysLeft >= 0;

    const rot = [...focusPool];
    const shift = i % Math.max(rot.length, 1);
    const focusRot = rot.length
      ? [...rot.slice(shift), ...rot.slice(0, shift)]
      : ["your course materials"];

    const { tasks, priority } = buildTasksForDay({
      dayIndex: i,
      focus: focusRot,
      fileNames: sprint ? orderedNames : orderedNames.slice(0, 4),
      sprint,
    });

    days.push({
      date: iso,
      label,
      tasks,
      focusConcepts: focusRot.slice(0, 4),
      minutesBudget: Math.round(hoursPerDay * 60),
      completed: false,
      isSprintDay: sprint,
      priorityTasks: priority,
    });

    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }

  return days;
}
