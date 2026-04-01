"use client";

import * as React from "react";
import Link from "next/link";
import { ListTodo, Redo2 } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { buttonVariants } from "@/lib/button-variants";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatIsoDateLongEn, toLocalDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function SubjectTodayPage() {
  const { subjectId, dailyPlan, mistakes, exam } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [clientTodayKey, setClientTodayKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    setClientTodayKey(toLocalDateKey(new Date()));
  }, []);

  const todayBlock =
    clientTodayKey != null
      ? dailyPlan.find((d) => d.date === clientTodayKey)
      : undefined;
  const nextBlock = dailyPlan.find((d) => !d.completed);

  const focus = todayBlock ?? nextBlock;

  if (dailyPlan.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Build a plan for this subject"
        description="Generate a schedule in the exam planner. Today’s focus will pull tasks for this course only."
      >
        <Link href={`${base}/exam-planner`} className={cn(buttonVariants())}>
          Open exam planner
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      {exam ? (
        <p className="text-sm text-muted-foreground">
          Working toward:{" "}
          <span className="font-medium text-foreground">{exam.name}</span> ·{" "}
          {formatIsoDateLongEn(exam.date)}
        </p>
      ) : null}

      <SectionCard
        title="Today’s focus"
        description={
          clientTodayKey == null
            ? "Loading today’s date…"
            : focus
              ? todayBlock != null
                ? "Tasks mapped to today’s date in your plan."
                : "No explicit block for today—showing the next upcoming session."
              : "All scheduled days in this window are marked complete, or extend your plan."
        }
      >
        {clientTodayKey == null ? (
          <p className="text-sm text-muted-foreground">
            Syncing with your device calendar…
          </p>
        ) : focus ? (
          <div className="space-y-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              {focus.label}
              {focus.isSprintDay ? (
                <Badge
                  variant="outline"
                  className="font-normal text-[10px] border-amber-500/50 text-amber-900 dark:text-amber-100"
                >
                  Final sprint day
                </Badge>
              ) : null}
            </p>
            {focus.priorityTasks && focus.priorityTasks.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Today’s priority tasks
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-foreground/90">
                  {focus.priorityTasks.slice(0, 5).map((p, i) => (
                    <li key={`${p.label}-${i}`}>
                      <span className="mr-1 text-xs font-medium text-muted-foreground">
                        ({p.importance})
                      </span>
                      {p.label}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
              {focus.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended review
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {focus.focusConcepts.map((c) => (
                  <Badge key={c} variant="secondary" className="font-normal">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You’re caught up on scheduled blocks in this window.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Retry mistakes"
        description="Scoped to this subject."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/quiz?retry=1`}
            className={cn(buttonVariants(), "gap-2")}
          >
            <Redo2 className="size-4" />
            Retry wrong questions
          </Link>
          <Link
            href={`${base}/mistakes`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Mistake notebook ({mistakes.length})
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Quick quiz" description="Opens quiz for your active document.">
        <Link href={`${base}/quiz`} className={cn(buttonVariants({ variant: "secondary" }))}>
          Open quiz
        </Link>
      </SectionCard>
    </div>
  );
}
