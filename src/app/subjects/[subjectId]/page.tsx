"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileStack,
  ListChecks,
  Plus,
  Target,
} from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { buttonVariants } from "@/lib/button-variants";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { SubjectIcon, accentRingClass } from "@/lib/subject-ui";
import { formatIsoDateLongEn } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function SubjectOverviewPage() {
  const {
    subjectId,
    subject,
    documents,
    mistakes,
    dailyPlan,
    studyCompletionPercent,
    readyDocumentCount,
  } = useSubjectWorkspace();

  const base = `/subjects/${subjectId}`;
  const recentDocs = [...documents]
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .slice(0, 4);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 border-b border-border/80 pb-8 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-2xl ring-2",
              accentRingClass(subject.accent)
            )}
          >
            <SubjectIcon id={subject.icon} className="size-7" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {subject.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {subject.examDate ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" />
                  Target: {formatIsoDateLongEn(subject.examDate)}
                </span>
              ) : (
                <span>No course exam date on subject</span>
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`${base}/upload`}
                className={cn(buttonVariants(), "gap-2")}
              >
                <Plus className="size-4" />
                Add PDF
              </Link>
              <Link
                href={`${base}/exam-planner`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Exam planner
              </Link>
            </div>
          </div>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto md:max-w-md">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              PDFs
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {documents.length}
            </p>
            <p className="text-xs text-muted-foreground">{readyDocumentCount} ready</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mistakes
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {mistakes.length}
            </p>
            <p className="text-xs text-muted-foreground">in notebook</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Plan
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {studyCompletionPercent}%
            </p>
            <Progress value={studyCompletionPercent} className="mt-2 h-1" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Documents"
          description="Everything you’ve uploaded for this subject stays here."
          action={
            <Link
              href={`${base}/upload`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7")}
            >
              Manage
            </Link>
          }
        >
          {documents.length === 0 ? (
            <EmptyState
              className="border-none bg-transparent py-8"
              title="No PDFs yet"
              description="Upload lecture slides or chapters—each file gets its own summary and quiz."
            >
              <Link href={`${base}/upload`} className={cn(buttonVariants())}>
                Upload a PDF
              </Link>
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {recentDocs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileStack className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{d.fileName}</span>
                    </div>
                    {d.pageCount != null && d.parseSucceeded ? (
                      <p className="mt-0.5 pl-6 text-[11px] text-muted-foreground">
                        {d.pageCount} pages extracted ·{" "}
                        {d.extractedText.length.toLocaleString()} chars
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={d.status === "ready" ? "default" : "secondary"}
                    className="shrink-0 text-[10px] capitalize"
                  >
                    {d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Shortcuts" description="Jump into study mode.">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                href: `${base}/summary`,
                label: "Summary",
                icon: BookOpen,
                sub: "Per active document",
              },
              {
                href: `${base}/quiz`,
                label: "Quiz",
                icon: ListChecks,
                sub: "MCQ & short answer",
              },
              {
                href: `${base}/mistakes`,
                label: "Mistakes",
                icon: ClipboardList,
                sub: `${mistakes.length} saved`,
              },
              {
                href: `${base}/weak-areas`,
                label: "Weak areas",
                icon: Target,
                sub: "Priority review",
              },
            ].map(({ href, label, icon: Icon, sub }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <Icon className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <ArrowRight className="ml-auto size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {(subject.exam || dailyPlan.length > 0) && (
        <SectionCard
          title="Plan preview"
          description="Today and progress stay scoped to this subject."
        >
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/today`} className={cn(buttonVariants({ variant: "secondary" }))}>
              Today’s focus
            </Link>
            <Link href={`${base}/progress`} className={cn(buttonVariants({ variant: "outline" }))}>
              Progress dashboard
            </Link>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
