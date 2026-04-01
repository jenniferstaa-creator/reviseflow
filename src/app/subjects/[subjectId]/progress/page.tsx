"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, LineChart, ListTodo } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { buttonVariants } from "@/lib/button-variants";
import { StatCard } from "@/components/stat-card";
import { SectionCard } from "@/components/section-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { calendarDaysUntilExamLocal } from "@/lib/dates";
import {
  buildConceptCatalog,
  countReviewsLastNDays,
  formatNextReviewLabel,
  formatReviewIntervalLabel,
  isSameLocalDay,
  mergeConceptReviewRows,
  normalizeConceptName,
  type ConceptReviewRow,
} from "@/lib/concept-review-catalog";
import { cn } from "@/lib/utils";

function masteryBadgeVariant(
  m: ConceptReviewRow["masteryStatus"]
): "default" | "secondary" | "destructive" | "outline" {
  if (m === "strong") return "default";
  if (m === "struggling") return "destructive";
  if (m === "new" || m === "upcoming") return "outline";
  return "secondary";
}

function ConceptReviewCard({ row, now }: { row: ConceptReviewRow; now: Date }) {
  const p = row.progress;
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground leading-snug">
            {row.conceptName}
          </p>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 dark:bg-primary/[0.09]">
            <FileText
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                Uploaded PDF
              </p>
              <p
                className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground"
                title={row.documentFileName}
              >
                {row.documentFileName}
              </p>
              {row.fromSubjectInsight ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Concept also appears in course insights; anchored to this file
                  for scheduling.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <Badge variant={masteryBadgeVariant(row.masteryStatus)} className="shrink-0 text-[10px] capitalize">
          {row.masteryStatus.replace(/-/g, " ")}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline" className="text-[10px] font-normal capitalize">
          {row.priority} priority
        </Badge>
        <Badge variant="secondary" className="text-[10px] font-normal">
          Interval · {formatReviewIntervalLabel(p.intervalDays)}
        </Badge>
        <Badge variant="secondary" className="text-[10px] font-normal">
          Next · {formatNextReviewLabel(p.nextReviewAt, now)}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Correct / incorrect (quiz checks):{" "}
        <span className="tabular-nums font-medium text-foreground">
          {p.correctCount} / {p.incorrectCount}
        </span>
        {p.lastReviewedAt ? (
          <>
            {" · "}
            Last:{" "}
            {new Date(p.lastReviewedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </>
        ) : (
          " · Not reviewed in app yet"
        )}
      </p>
    </div>
  );
}

export default function SubjectProgressPage() {
  const {
    subjectId,
    subject,
    exam,
    studyCompletionPercent,
    mistakes,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [clientNow, setClientNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setClientNow(new Date());
  }, [subject.updatedAt, subject.documents.length, mistakes.length]);

  const catalogLen = React.useMemo(
    () => buildConceptCatalog(subject).length,
    [subject]
  );

  const rows = React.useMemo(() => {
    if (!clientNow) return [];
    return mergeConceptReviewRows(subject, clientNow);
  }, [subject, clientNow]);

  const partitioned = React.useMemo(() => {
    if (!clientNow || rows.length === 0) {
      return {
        overdue: [] as ConceptReviewRow[],
        upcoming: [] as ConceptReviewRow[],
        weak: [] as ConceptReviewRow[],
        doneToday: [] as ConceptReviewRow[],
        onTrack: [] as ConceptReviewRow[],
      };
    }
    const now = clientNow;
    const weekEnd = new Date(now.getTime() + 7 * 86_400_000);

    const overdue = rows.filter(
      (r) => new Date(r.progress.nextReviewAt).getTime() < now.getTime()
    );

    const upcoming = rows.filter((r) => {
      const t = new Date(r.progress.nextReviewAt).getTime();
      return t >= now.getTime() && t <= weekEnd.getTime();
    });

    const weak = rows.filter(
      (r) =>
        r.masteryStatus === "struggling" ||
        (r.priority === "high" &&
          (r.progress.incorrectCount > 0 ||
            mistakes.some(
              (m) =>
                m.documentId === r.documentId &&
                normalizeConceptName(m.conceptTag) ===
                  normalizeConceptName(r.conceptName)
            )))
    );

    const doneToday = rows.filter(
      (r) =>
        r.progress.lastReviewedAt != null &&
        isSameLocalDay(new Date(r.progress.lastReviewedAt), now)
    );

    const onTrack = rows.filter(
      (r) =>
        r.masteryStatus === "strong" &&
        new Date(r.progress.nextReviewAt).getTime() > now.getTime()
    );

    return { overdue, upcoming, weak, doneToday, onTrack };
  }, [rows, clientNow, mistakes]);

  const reviews7d = React.useMemo(() => {
    if (!clientNow) return 0;
    return countReviewsLastNDays(subject.conceptReviewByKey ?? {}, clientNow, 7);
  }, [subject.conceptReviewByKey, clientNow]);

  const weakFromMistakes = React.useMemo(
    () => [...new Set(mistakes.map((m) => m.conceptTag))],
    [mistakes]
  );

  const dLeft =
    exam?.date != null && clientNow != null
      ? Math.max(0, calendarDaysUntilExamLocal(clientNow, exam.date))
      : null;

  if (clientNow != null && catalogLen === 0) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={LineChart}
          title="No concepts to track yet"
          description="Progress and spaced repetition build automatically from ready PDFs (summaries and quizzes), your mistake notebook, and course insights. Upload and analyze materials first—then quiz checks will schedule reviews."
        >
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`${base}/upload`} className={cn(buttonVariants())}>
              Upload PDFs
            </Link>
            <Link
              href={`${base}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Course overview
            </Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Everything below is tied to{" "}
        <span className="font-medium text-foreground">this subject’s real data</span>
        —uploaded summaries, quiz tags, mistakes, and your review history. There
        are no sample repetition cards here once tracking exists.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Days until exam"
          value={
            exam?.date == null
              ? "—"
              : clientNow == null
                ? "…"
                : dLeft
          }
          hint={
            exam
              ? undefined
              : "Set a plan in the exam planner for this subject."
          }
        />
        <StatCard
          label="Concepts tracked"
          value={catalogLen}
          hint="From summaries, quizzes, mistakes & insights."
        />
        <StatCard
          label="Reviews (7 days)"
          value={clientNow == null ? "…" : reviews7d}
          hint="Concepts with at least one quiz check logged."
        />
        <StatCard
          label="Plan completion"
          value={
            studyCompletionPercent === 0 && !exam
              ? "—"
              : `${studyCompletionPercent}%`
          }
          hint="Scheduled days marked complete."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue reviews"
          value={
            clientNow == null ? "…" : partitioned.overdue.length
          }
          hint="Next review date in the past."
        />
        <StatCard
          label="Due within 7 days"
          value={
            clientNow == null ? "…" : partitioned.upcoming.length
          }
          hint="Includes today through the next week."
        />
        <StatCard
          label="Weak signals"
          value={
            clientNow == null ? "…" : partitioned.weak.length
          }
          hint="High load or wrong answers vs rights."
        />
        <StatCard
          label="Checked today"
          value={
            clientNow == null ? "…" : partitioned.doneToday.length
          }
          hint="Quiz reviews logged today."
        />
      </div>

      <SectionCard
        title="Concept strength"
        description="Derived from your quiz outcomes and mistake notebook — not demo topic lists."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On track
            </p>
            {partitioned.onTrack.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No concepts in a strong groove yet. Keep answering quiz items
                correctly to stretch intervals.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {partitioned.onTrack.slice(0, 20).map((r) => (
                  <Badge key={r.key} variant="outline" className="font-normal">
                    {r.conceptName}
                  </Badge>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Weak / priority
            </p>
            {(weakFromMistakes.length === 0 && partitioned.weak.length === 0) ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No weak signals yet. Missing quiz answers will appear here.
              </p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {[
                  ...new Set([
                    ...weakFromMistakes,
                    ...partitioned.weak.map((r) => r.conceptName),
                  ]),
                ]
                  .slice(0, 24)
                  .map((t) => (
                    <Badge key={t} variant="secondary" className="font-normal">
                      {t}
                    </Badge>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Overall study plan"
        description="Based on this subject’s exam planner only."
      >
        <Progress value={studyCompletionPercent} />
        <p className="mt-2 text-sm text-muted-foreground">
          {studyCompletionPercent}% of scheduled days marked complete.
        </p>
        <Link
          href={`${base}/exam-planner`}
          className={cn(
            buttonVariants({ variant: "link" }),
            "mt-2 h-auto px-0 text-sm"
          )}
        >
          Adjust plan
        </Link>
      </SectionCard>

      <SectionCard
        title="Spaced repetition queue"
        description="Simple scheduler: wrong answers shorten the interval; correct answers extend it. Schedule updates whenever you check a quiz question."
        action={
          <Link
            href={`${base}/quiz`}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "h-8 gap-1.5"
            )}
          >
            <ListTodo className="size-3.5" />
            Go to quiz
          </Link>
        }
      >
        {clientNow == null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-8">
            {partitioned.overdue.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Overdue ({partitioned.overdue.length})
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Past their next-review date — tackle these first if you can.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {partitioned.overdue.map((r) => (
                    <ConceptReviewCard key={r.key} row={r} now={clientNow} />
                  ))}
                </div>
              </div>
            ) : null}

            {partitioned.weak.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Weak concepts ({partitioned.weak.length})
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mismatch between correct and incorrect checks, or mistakes
                  logged for this tag.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {partitioned.weak.map((r) => (
                    <ConceptReviewCard key={`w-${r.key}`} row={r} now={clientNow} />
                  ))}
                </div>
              </div>
            ) : null}

            {partitioned.upcoming.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Upcoming (7 days) ({partitioned.upcoming.length})
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {partitioned.upcoming.map((r) => (
                    <ConceptReviewCard key={r.key} row={r} now={clientNow} />
                  ))}
                </div>
              </div>
            ) : null}

            {partitioned.doneToday.length > 0 ? (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardCheck className="size-4 text-primary" />
                  Completed reviews today ({partitioned.doneToday.length})
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {partitioned.doneToday.map((r) => (
                    <ConceptReviewCard key={`d-${r.key}`} row={r} now={clientNow} />
                  ))}
                </div>
              </div>
            ) : null}

            {partitioned.overdue.length === 0 &&
            partitioned.upcoming.length === 0 &&
            partitioned.weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing urgent in the queue right now — open the quiz to log more
                checks and move intervals forward.
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
