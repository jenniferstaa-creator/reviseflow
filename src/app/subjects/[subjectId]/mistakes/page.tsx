"use client";

import Link from "next/link";
import { BookX, Sparkles } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import type { ErrorType } from "@/data/types";
import { cn } from "@/lib/utils";

const errorStyles: Record<
  ErrorType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  "Concept misunderstanding": "destructive",
  "Memory weakness": "secondary",
  "Application issue": "outline",
  "Careless mistake": "secondary",
};

export default function SubjectMistakesPage() {
  const {
    subjectId,
    mistakes,
    documents,
    loadSampleMistakes,
    clearMistakes,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const docName = (id: string) =>
    documents.find((d) => d.id === id)?.fileName ?? "Document";

  if (mistakes.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={BookX}
          title="No mistakes logged yet"
          description="When a quiz answer misses the mark in this subject, it lands here with the correct path and context—including which PDF it came from."
        >
          <Link href={`${base}/quiz`} className={cn(buttonVariants())}>
            Take the quiz
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => loadSampleMistakes()}
          >
            Load sample mistakes
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {mistakes.length} item{mistakes.length === 1 ? "" : "s"} · sorted
          newest first
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/weak-areas`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Weak areas
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => clearMistakes()}
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {mistakes.map((m) => (
          <SectionCard
            key={m.id}
            title={m.question}
            action={
              <Badge variant={errorStyles[m.errorType]} className="shrink-0">
                {m.errorType}
              </Badge>
            }
          >
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-normal">
                  {m.conceptTag}
                </Badge>
                <Badge variant="secondary" className="font-normal text-[10px]">
                  From: {docName(m.documentId)}
                </Badge>
              </div>
              <div className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Your answer
                  </p>
                  <p className="mt-0.5 text-foreground/90">{m.userAnswer}</p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Correct answer
                  </p>
                  <p className="mt-0.5 text-foreground/90">{m.correctAnswer}</p>
                </div>
              </div>
              <p className="leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Why: </span>
                {m.explanation}
              </p>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-dashed border-border/80 bg-card/50 p-4 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          {/* TODO(OpenAI): Classify error type from model + learner profile instead of heuristics */}
          Revisit the concept tag, then redo missed items in{" "}
          <Link
            href={`${base}/quiz?retry=1`}
            className="font-medium text-primary hover:underline"
          >
            retry mode
          </Link>{" "}
          for your active document.
        </p>
      </div>
    </div>
  );
}
