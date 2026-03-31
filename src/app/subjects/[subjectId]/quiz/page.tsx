"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, ListChecks } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { guessErrorType } from "@/data/mock-course";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { DocumentSelector } from "@/components/document-selector";
import { cn } from "@/lib/utils";
import type { QuizQuestionMCQ, QuizQuestionShort } from "@/data/types";

export default function SubjectQuizPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading quiz…</p>
      }
    >
      <SubjectQuizInner />
    </Suspense>
  );
}

function SubjectQuizInner() {
  const searchParams = useSearchParams();
  const retryMode = searchParams.get("retry") === "1";
  const {
    subjectId,
    selectedDocument,
    documents,
    mistakes,
    addMistake,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;
  const quiz = selectedDocument?.quiz ?? null;

  const relevantMistakes = React.useMemo(() => {
    if (!selectedDocument) return mistakes;
    return mistakes.filter((m) => m.documentId === selectedDocument.id);
  }, [mistakes, selectedDocument]);

  const mistakeIds = React.useMemo(
    () => new Set(relevantMistakes.map((m) => m.questionId)),
    [relevantMistakes]
  );

  const mcqList = React.useMemo(() => {
    if (!quiz) return [];
    if (!retryMode) return quiz.multipleChoice;
    return quiz.multipleChoice.filter((q) => mistakeIds.has(q.id));
  }, [quiz, retryMode, mistakeIds]);

  const shortList = React.useMemo(() => {
    if (!quiz) return [];
    if (!retryMode) return quiz.shortAnswer;
    return quiz.shortAnswer.filter((q) => mistakeIds.has(q.id));
  }, [quiz, retryMode, mistakeIds]);

  const [mcqAnswers, setMcqAnswers] = React.useState<Record<string, string>>({});
  const [shortAnswers, setShortAnswers] = React.useState<Record<string, string>>(
    {}
  );
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [score, setScore] = React.useState<{
    correct: number;
    total: number;
  } | null>(null);

  const ready = documents.some((d) => d.status === "ready");
  const docId = selectedDocument?.id;

  if (!ready) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No quiz yet"
        description="Analyze at least one PDF in this subject to attach questions."
      >
        <Link href={`${base}/upload`} className={cn(buttonVariants())}>
          Upload PDF
        </Link>
      </EmptyState>
    );
  }

  if (!selectedDocument || !quiz || !docId) {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <EmptyState
          icon={ListChecks}
          title="Select a document"
          description="Choose a ready document to take its quiz. Each PDF keeps its own question set."
        />
      </div>
    );
  }

  if (retryMode && mcqList.length === 0 && shortList.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nothing to retry for this document"
        description="Try missing questions from this PDF first—or switch document and retry again."
      >
        <Link href={`${base}/quiz`} className={cn(buttonVariants())}>
          Full quiz
        </Link>
      </EmptyState>
    );
  }

  const toggleReveal = (id: string) => {
    setRevealed((r) => ({ ...r, [id]: !r[id] }));
  };

  const grade = () => {
    let correct = 0;
    let total = 0;
    for (const q of mcqList) {
      total += 1;
      const a = mcqAnswers[q.id];
      if (a === q.correctAnswer) correct += 1;
      else if (a) {
        addMistake(docId, {
          questionId: q.id,
          question: q.question,
          userAnswer: a,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          conceptTag: q.conceptTag,
          errorType: guessErrorType(a, q.correctAnswer, q.conceptTag),
        });
      }
    }
    for (const q of shortList) {
      total += 1;
      const a = (shortAnswers[q.id] ?? "").trim();
      const norm = (s: string) =>
        s.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
      const ok =
        a.length > 20 &&
        norm(q.correctAnswer)
          .split(" ")
          .filter((w) => norm(a).includes(w)).length >= 4;
      if (ok) correct += 1;
      else if (a.length > 0) {
        addMistake(docId, {
          questionId: q.id,
          question: q.question,
          userAnswer: a,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          conceptTag: q.conceptTag,
          errorType: guessErrorType(a, q.correctAnswer, q.conceptTag),
        });
      }
    }
    setScore({ correct, total });
    setSubmitted(true);
  };

  return (
    <div className="space-y-8">
      {selectedDocument.contentSource === "extracted" &&
      selectedDocument.parseSucceeded ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Questions are generated from this PDF&apos;s extracted text (rule-based,
          not an external AI). In Summary, open the &quot;Extracted text&quot; tab
          to verify the source.
        </p>
      ) : null}
      <DocumentSelector />
      {retryMode ? (
        <Badge variant="secondary" className="text-xs font-normal">
          Retry · this document only
        </Badge>
      ) : null}

      <Tabs defaultValue="mcq">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="mcq">
            Multiple choice ({mcqList.length})
          </TabsTrigger>
          <TabsTrigger value="short">
            Short answer ({shortList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcq" className="mt-6 space-y-6">
          {mcqList.map((q) => (
            <McqBlock
              key={q.id}
              q={q}
              value={mcqAnswers[q.id]}
              onChange={(v) =>
                setMcqAnswers((s) => ({ ...s, [q.id]: v }))
              }
              revealed={!!revealed[q.id]}
              onReveal={() => toggleReveal(q.id)}
              submitted={submitted}
            />
          ))}
        </TabsContent>

        <TabsContent value="short" className="mt-6 space-y-6">
          {shortList.map((q) => (
            <ShortBlock
              key={q.id}
              q={q}
              value={shortAnswers[q.id] ?? ""}
              onChange={(v) =>
                setShortAnswers((s) => ({ ...s, [q.id]: v }))
              }
              revealed={!!revealed[q.id]}
              onReveal={() => toggleReveal(q.id)}
              submitted={submitted}
            />
          ))}
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3 border-t border-border/80 pt-6">
        <Button type="button" onClick={grade} disabled={submitted}>
          {submitted ? "Submitted" : "Submit and score"}
        </Button>
        {submitted && score ? (
          <p className="text-sm text-muted-foreground">
            Score:{" "}
            <span className="font-semibold text-foreground">
              {score.correct}/{score.total}
            </span>{" "}
            correct
          </p>
        ) : null}
        <Link
          href={`${base}/mistakes`}
          className={cn(buttonVariants({ variant: "ghost" }), "ml-auto")}
        >
          View mistake notebook
        </Link>
      </div>
    </div>
  );
}

function McqBlock({
  q,
  value,
  onChange,
  revealed,
  onReveal,
  submitted,
}: {
  q: QuizQuestionMCQ;
  value: string | undefined;
  onChange: (v: string) => void;
  revealed: boolean;
  onReveal: () => void;
  submitted: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-foreground">{q.question}</p>
      <Badge variant="outline" className="mt-2 font-normal text-[10px]">
        {q.conceptTag}
      </Badge>
      <ul className="mt-4 space-y-2">
        {q.options.map((opt) => (
          <li key={opt}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-sm hover:bg-muted/50 has-[:checked]:border-primary/30 has-[:checked]:bg-accent/40">
              <input
                type="radio"
                name={q.id}
                className="mt-1"
                checked={value === opt}
                onChange={() => onChange(opt)}
                disabled={submitted}
              />
              <span>{opt}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReveal}
        >
          <Eye className="size-3.5" />
          {revealed ? "Hide explanation" : "Show answer"}
        </Button>
        {revealed || submitted ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Correct: </span>
            {q.correctAnswer}. {q.explanation}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShortBlock({
  q,
  value,
  onChange,
  revealed,
  onReveal,
  submitted,
}: {
  q: QuizQuestionShort;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onReveal: () => void;
  submitted: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-foreground">{q.question}</p>
      <Badge variant="outline" className="mt-2 font-normal text-[10px]">
        {q.conceptTag}
      </Badge>
      <textarea
        className="mt-4 min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={submitted}
        placeholder="Write a concise answer in your own words…"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReveal}
        >
          <Eye className="size-3.5" />
          {revealed ? "Hide model answer" : "Reveal model answer"}
        </Button>
        {revealed || submitted ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Model: </span>
            {q.correctAnswer} {q.explanation}
          </p>
        ) : null}
      </div>
    </div>
  );
}
