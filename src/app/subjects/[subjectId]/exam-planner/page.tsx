"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function SubjectExamPlannerPage() {
  const {
    subjectId,
    subject,
    exam,
    dailyPlan,
    saveExamPlan,
    toggleDayCompleted,
    setPartialPlanProgress,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [name, setName] = React.useState(
    () => exam?.name ?? `${subject.name} · Exam`
  );
  const [date, setDate] = React.useState(
    () => exam?.date ?? subject.examDate ?? "2026-04-21"
  );
  const [hours, setHours] = React.useState(() => exam?.hoursPerDay ?? 2);

  const onGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    saveExamPlan({ name, date, hoursPerDay: hours });
    // TODO(DB): persist StudyPlan; TODO(OpenAI): personalize tasks from summary + mistakes
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Exam details"
        description="Plan is saved for this subject only. Re-generating replaces the current schedule."
      >
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onGenerate}>
          <div className="sm:col-span-2 space-y-1.5">
            <label
              htmlFor="exam-name"
              className="text-xs font-medium text-muted-foreground"
            >
              Exam name
            </label>
            <input
              id="exam-name"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="exam-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Exam date
            </label>
            <input
              id="exam-date"
              type="date"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="hours"
              className="text-xs font-medium text-muted-foreground"
            >
              Study hours / day
            </label>
            <input
              id="hours"
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              required
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit">
              <CalendarClock className="size-4" />
              Generate plan
            </Button>
            {dailyPlan.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartialPlanProgress(2)}
              >
                Demo: mark first 2 days done
              </Button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      {dailyPlan.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Generate a plan to see daily tasks. Inputs are stored with this subject
          in your browser.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-base font-semibold">
              Daily revision plan
            </h3>
            <Badge variant="secondary">{dailyPlan.length} days</Badge>
          </div>
          <ScrollArea className="h-[min(480px,55vh)] rounded-xl border border-border/80 pr-3">
            <ul className="space-y-3 pb-2">
              {dailyPlan.map((d) => (
                <li
                  key={d.date}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {d.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~{d.minutesBudget} min budget
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDayCompleted(d.date)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                        d.completed
                          ? "border-primary/40 bg-accent text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      <CheckCircle2 className="size-3.5" />
                      {d.completed ? "Completed" : "Mark done"}
                    </button>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                    {d.tasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {d.focusConcepts.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <Link
            href={`${base}/today`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Go to today’s focus
          </Link>
        </>
      )}
    </div>
  );
}
