"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  FileStack,
  Plus,
  Trash2,
} from "lucide-react";
import { useWorkspace } from "@/context/workspace-context";
import type { SubjectAccent, SubjectIconId } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SUBJECT_ACCENTS,
  SUBJECT_ICONS,
  SubjectIcon,
  accentBorderClass,
  accentRingClass,
} from "@/lib/subject-ui";
import { formatIsoDateLongEn } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function SubjectsPage() {
  const router = useRouter();
  const {
    subjects,
    hydrated,
    createSubject,
    deleteSubject,
  } = useWorkspace();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [examDate, setExamDate] = React.useState("");
  const [accent, setAccent] = React.useState<SubjectAccent>("teal");
  const [icon, setIcon] = React.useState<SubjectIconId>("book-open");

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = createSubject({
      name: name.trim(),
      examDate: examDate.trim() || undefined,
      accent,
      icon,
    });
    setOpen(false);
    setName("");
    setExamDate("");
    setAccent("teal");
    setIcon("book-open");
    router.push(`/subjects/${id}`);
  };

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-sm text-muted-foreground md:px-8">
        Loading your courses…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Study workspaces
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Subjects
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Each subject has its own documents, quizzes, mistakes, and plan—organized like a real course workspace.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            )}
          >
            <Plus className="size-4" />
            New subject
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-md">
            <SheetHeader>
              <SheetTitle>New subject</SheetTitle>
              <SheetDescription>
                Create a workspace for one course or exam. You can add many PDFs inside it later.
              </SheetDescription>
            </SheetHeader>
            <form className="mt-6 flex flex-col gap-4 px-4 pb-6" onSubmit={onCreate}>
              <div className="space-y-1.5">
                <label htmlFor="sub-name" className="text-xs font-medium text-muted-foreground">
                  Subject name
                </label>
                <input
                  id="sub-name"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Operations & SCM"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="sub-exam" className="text-xs font-medium text-muted-foreground">
                  Target exam date (optional)
                </label>
                <input
                  id="sub-exam"
                  type="date"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Accent</span>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        accent === a.value
                          ? "border-primary bg-accent text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                      )}
                      onClick={() => setAccent(a.value)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Icon</span>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_ICONS.map((i) => (
                    <button
                      key={i.value}
                      type="button"
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border transition-colors",
                        icon === i.value
                          ? "border-primary bg-accent"
                          : "border-border bg-background hover:bg-muted/60"
                      )}
                      onClick={() => setIcon(i.value)}
                      aria-label={i.label}
                    >
                      <SubjectIcon id={i.value} className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">
                  Create workspace
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {subjects.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={BookMarked}
            title="No subjects yet"
            description="Create your first subject to start uploading lecture PDFs, running quizzes, and tracking mistakes in one dedicated workspace per course."
          >
            <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New subject
            </Button>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const ready = s.documents.filter((d) => d.status === "ready").length;
            const pct =
              s.dailyPlan.length === 0
                ? 0
                : Math.round(
                    (s.dailyPlan.filter((d) => d.completed).length /
                      s.dailyPlan.length) *
                      100
                  );
            return (
              <li key={s.id}>
                <Card
                  className={cn(
                    "group h-full border-border/80 border-l-4 shadow-sm transition-shadow hover:shadow-md",
                    accentBorderClass(s.accent)
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl ring-2",
                          accentRingClass(s.accent)
                        )}
                      >
                        <SubjectIcon id={s.icon} className="size-5" />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label={`Delete ${s.name}`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm(`Delete “${s.name}” and all its documents?`)) {
                            deleteSubject(s.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Link href={`/subjects/${s.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <CardTitle className="font-heading text-base leading-snug group-hover:text-primary">
                        {s.name}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {s.examDate ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {formatIsoDateLongEn(s.examDate)}
                          </span>
                        ) : (
                          <span>No exam date set</span>
                        )}
                      </CardDescription>
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="font-normal">
                        <FileStack className="mr-1 size-3" />
                        {s.documents.length} PDF{s.documents.length === 1 ? "" : "s"}
                      </Badge>
                      {ready > 0 ? (
                        <Badge variant="outline" className="font-normal">
                          {ready} analyzed
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Plan progress</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Updated {formatIsoDateLongEn(s.updatedAt.slice(0, 10))}
                    </p>
                    <Link
                      href={`/subjects/${s.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Open workspace
                      <ArrowRight className="size-4" />
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
