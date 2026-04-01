"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileStack,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
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
import { getSubjectCourseStats } from "@/lib/subject-stats";
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
    subjectAnalysis,
    subjectAnalysisMeta,
    subjectInsightsStale,
    refreshSubjectAnalysis,
  } = useSubjectWorkspace();

  const base = `/subjects/${subjectId}`;
  const [insightsBusy, setInsightsBusy] = React.useState(false);

  const onRefreshInsights = async () => {
    setInsightsBusy(true);
    try {
      await refreshSubjectAnalysis();
    } finally {
      setInsightsBusy(false);
    }
  };

  const courseStats = React.useMemo(
    () => getSubjectCourseStats(subject),
    [subject]
  );

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
        <div className="w-full space-y-3 md:max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Course at a glance
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                PDFs uploaded
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {courseStats.pdfCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Files in this subject
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Analyzed
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {courseStats.analyzedReadyCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {courseStats.analyzedWithMaterialsCount} with summary or quiz
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Quiz questions
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {courseStats.totalQuizQuestions}
              </p>
              <p className="text-xs text-muted-foreground">
                Across all documents
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Mistakes
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {courseStats.totalMistakes}
              </p>
              <p className="text-xs text-muted-foreground">In your notebook</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Weak topics
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {courseStats.weakTopicCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Distinct tags &amp; insight areas
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Plan progress
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {studyCompletionPercent}%
              </p>
              <Progress value={studyCompletionPercent} className="mt-2 h-1" />
            </div>
          </div>
        </div>
      </div>

      <div id="course-insights">
      <SectionCard
        title="Course insights (subject level)"
        description="Synthesised from all PDF summaries and your mistakes — not raw files. Use this for the big picture; open Summary for a single document."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {subjectAnalysisMeta ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {subjectAnalysisMeta.source === "openai" ? "AI synthesis" : "Rule-based merge"}
              </Badge>
            ) : null}
            <button
              type="button"
              disabled={insightsBusy || readyDocumentCount === 0}
              onClick={() => void onRefreshInsights()}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-muted/80 disabled:opacity-50"
              )}
            >
              {insightsBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </button>
          </div>
        }
      >
        {subjectInsightsStale ? (
          <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100/90">
            Your PDFs changed since the last run. Refresh to update this section.
          </p>
        ) : null}
        {!subjectAnalysis ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Layers className="size-4 text-primary" />
              No course insights yet
            </p>
            <p className="mt-2 leading-relaxed">
              {readyDocumentCount === 0
                ? "Upload at least one PDF and wait until its summary is ready, then refresh."
                : "Tap Refresh to merge every ready summary into a course overview, shared themes, and a recommended chapter order."}
            </p>
            <button
              type="button"
              disabled={insightsBusy || readyDocumentCount === 0}
              onClick={() => void onRefreshInsights()}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent/50 disabled:opacity-50"
              )}
            >
              {insightsBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Generate course insights
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Course overview
              </p>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {subjectAnalysis.courseOverview}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Top concepts
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/90">
                  {subjectAnalysis.topConcepts.slice(0, 10).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Repeated themes
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/90">
                  {subjectAnalysis.repeatedThemes.slice(0, 10).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Weakest areas to prioritise
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subjectAnalysis.weakestAreas.map((c) => (
                  <Badge key={c} variant="outline" className="font-normal">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recommended revision order (documents)
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm text-foreground/90">
                {subjectAnalysis.recommendedRevisionOrder.map((r) => (
                  <li key={r.documentId}>
                    <span className="font-medium">{r.fileName}</span> —{" "}
                    {r.rationale}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SectionCard>
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
                sub: "One PDF at a time (picker)",
              },
              {
                href: `${base}/quiz`,
                label: "Quiz",
                icon: ListChecks,
                sub: "MCQ & short answer",
              },
              {
                href: `${base}/mock-practice`,
                label: "Practice",
                icon: ScrollText,
                sub: "From your PDFs or past papers",
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
