"use client";

import * as React from "react";
import Link from "next/link";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import {
  MOCK_SPACED_REPETITION,
  MOCK_MASTERED_TOPICS,
  MOCK_WEAK_TOPICS,
} from "@/data/mock-course";
import { buttonVariants } from "@/lib/button-variants";
import { StatCard } from "@/components/stat-card";
import { SectionCard } from "@/components/section-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { calendarDaysUntilExamLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function SubjectProgressPage() {
  const {
    subjectId,
    exam,
    revisionStreakDays,
    studyCompletionPercent,
    mistakes,
    readyDocumentCount,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [clientNow, setClientNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setClientNow(new Date());
  }, [exam?.date]);

  const dLeft =
    exam?.date != null && clientNow != null
      ? Math.max(0, calendarDaysUntilExamLocal(clientNow, exam.date))
      : null;

  const weakFromMistakes = [...new Set(mistakes.map((m) => m.conceptTag))];

  return (
    <div className="space-y-8">
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
          label="PDFs analyzed"
          value={readyDocumentCount}
          hint="Documents marked ready in this subject."
        />
        <StatCard
          label="Revision streak"
          value={`${revisionStreakDays} days`}
          hint="Demo placeholder until activity is tracked."
        />
        <StatCard
          label="Plan completion"
          value={
            studyCompletionPercent === 0 && !exam
              ? "—"
              : `${studyCompletionPercent}%`
          }
          hint="Share of this subject’s planned days complete."
        />
      </div>

      <SectionCard
        title="Topic balance"
        description="Demo lists plus concepts from this subject’s notebook."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mastered topics (sample)
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {MOCK_MASTERED_TOPICS.map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  {t}
                </Badge>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Weak topics
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {(weakFromMistakes.length ? weakFromMistakes : MOCK_WEAK_TOPICS).map(
                (t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                )
              )}
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Overall study progress"
        description="You’re making progress when the bar moves—based on this subject’s plan."
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
        title="Spaced repetition (preview)"
        description="Mock intervals for this workspace."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {MOCK_SPACED_REPETITION.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border/80 bg-muted/30 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {s.conceptTag}
                </p>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Review in {s.nextReviewLabel}
                </Badge>
              </div>
              <Progress value={s.strength * 100} className="mt-3" />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Strength indicator (mock)
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
