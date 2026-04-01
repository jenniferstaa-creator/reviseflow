"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { guessErrorType } from "@/data/mock-course";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { DocumentSelector } from "@/components/document-selector";
import { cn } from "@/lib/utils";
import type { QuizQuestionMCQ, QuizQuestionShort } from "@/data/types";

function normAnswer(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

/** Same heuristic as before: keyword overlap with model answer. */
function isShortAnswerCorrect(userRaw: string, modelAnswer: string): boolean {
  const a = userRaw.trim();
  if (a.length <= 20) return false;
  const aNorm = normAnswer(a);
  const mNorm = normAnswer(modelAnswer);
  const hitCount = mNorm.split(" ").filter((w) => aNorm.includes(w)).length;
  return hitCount >= 4;
}

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
    removeMistakeForQuestion,
    recordConceptReview,
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

  const [mcqAnswers, setMcqAnswers] = React.useState<Record<string, string>>(
    {}
  );
  const [shortAnswers, setShortAnswers] = React.useState<
    Record<string, string>
  >({});
  /** Set when user clicks "Check answer" for that question id. */
  const [checked, setChecked] = React.useState<
    Record<string, { correct: boolean }>
  >({});
  const [checkHints, setCheckHints] = React.useState<Record<string, string>>(
    {}
  );

  React.useEffect(() => {
    setMcqAnswers({});
    setShortAnswers({});
    setChecked({});
    setCheckHints({});
  }, [selectedDocument?.id, retryMode]);

  const readyDocs = documents.filter((d) => d.status === "ready");
  const hasAnalyzing = documents.some(
    (d) => d.status === "uploading" || d.status === "analyzing"
  );
  const docId = selectedDocument?.id;

  const totalQuestions = mcqList.length + shortList.length;
  const checkedEntries = Object.entries(checked);
  const checkedCount = checkedEntries.length;
  const correctCount = checkedEntries.filter(([, v]) => v.correct).length;
  const incorrectCount = checkedCount - correctCount;
  const allChecked =
    totalQuestions > 0 && checkedCount === totalQuestions;
  const completionPercent =
    totalQuestions === 0 ? 0 : Math.round((checkedCount / totalQuestions) * 100);

  const wrongInNotebook = relevantMistakes.length;

  if (readyDocs.length === 0) {
    if (hasAnalyzing) {
      return (
        <EmptyState
          icon={BookMarked}
          title="Preparing your quiz…"
          description="Text extraction, AI summary, and AI quiz generation are running. This can take a minute—try Files & upload for the live step, or wait here."
        >
          <Loader2
            className="size-8 animate-spin text-primary"
            aria-label="Loading"
          />
        </EmptyState>
      );
    }
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

  if (selectedDocument?.status === "analyzing") {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-6 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            Generating quiz for “{selectedDocument.fileName}”…
          </p>
          <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
            {selectedDocument.analysisStep ?? "Working…"}
          </p>
        </div>
      </div>
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
        description="Miss at least one question in this PDF first—or switch document and open retry again."
      >
        <Link href={`${base}/quiz`} className={cn(buttonVariants())}>
          Full quiz
        </Link>
      </EmptyState>
    );
  }

  /** Multiple choice: evaluate immediately when the learner picks an option. */
  const handleMcqPick = (q: QuizQuestionMCQ, sel: string) => {
    setMcqAnswers((s) => ({ ...s, [q.id]: sel }));
    setCheckHints((h) => {
      const next = { ...h };
      delete next[q.id];
      return next;
    });
    const correct = sel === q.correctAnswer;
    setChecked((c) => ({ ...c, [q.id]: { correct } }));
    if (correct) {
      removeMistakeForQuestion(docId, q.id);
    } else {
      addMistake(docId, {
        questionId: q.id,
        question: q.question,
        userAnswer: sel,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        conceptTag: q.conceptTag,
        errorType: guessErrorType(sel, q.correctAnswer, q.conceptTag),
      });
    }
    recordConceptReview(docId, q.conceptTag, correct ? "correct" : "incorrect");
  };

  const setShortResponse = (questionId: string, value: string) => {
    setShortAnswers((s) => ({ ...s, [questionId]: value }));
    if (checked[questionId]) {
      setChecked((c) => {
        const next = { ...c };
        delete next[questionId];
        return next;
      });
    }
    setCheckHints((h) => {
      if (!h[questionId]) return h;
      const next = { ...h };
      delete next[questionId];
      return next;
    });
  };

  const runCheckShort = (q: QuizQuestionShort) => {
    const raw = shortAnswers[q.id] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) {
      setCheckHints((h) => ({
        ...h,
        [q.id]: "Write an answer in your own words, then check against the model.",
      }));
      return;
    }
    setCheckHints((h) => {
      const next = { ...h };
      delete next[q.id];
      return next;
    });
    const correct = isShortAnswerCorrect(raw, q.correctAnswer);
    setChecked((c) => ({ ...c, [q.id]: { correct } }));
    if (correct) {
      removeMistakeForQuestion(docId, q.id);
    } else {
      addMistake(docId, {
        questionId: q.id,
        question: q.question,
        userAnswer: trimmed,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        conceptTag: q.conceptTag,
        errorType: guessErrorType(trimmed, q.correctAnswer, q.conceptTag),
      });
    }
    recordConceptReview(
      docId,
      q.conceptTag,
      correct ? "correct" : "incorrect"
    );
  };

  return (
    <div className="space-y-6">
      {selectedDocument.quizSource === "openai" ? (
        <p className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2 text-center text-xs font-medium text-foreground">
          Generated from uploaded PDF content
        </p>
      ) : null}
      {selectedDocument.quizError ? (
        <div className="space-y-2 rounded-lg border border-amber-300/80 bg-amber-50/90 px-3 py-3 text-xs text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="rounded-md border border-emerald-300/60 bg-emerald-500/[0.08] px-2.5 py-2 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-100">
            <p className="font-medium">Parsing succeeded</p>
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
              Your PDF text was extracted. The issue below is only with AI quiz
              generation—you still have rule-based questions from the same text.
            </p>
          </div>
          <p>
            <span className="font-medium">Quiz generation failed · </span>
            {selectedDocument.quizError}
          </p>
        </div>
      ) : null}

      <DocumentSelector />

      <div
        className="sticky top-0 z-20 -mx-1 border-b border-border/60 bg-background/90 px-1 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
        aria-live="polite"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">
                Session progress
              </p>
              {retryMode ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Retry wrong · this document
                </Badge>
              ) : null}
            </div>
            <div
              className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Share of questions checked"
            >
              <div
                className="h-full rounded-full bg-primary/70 transition-[width] duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {checkedCount}
              </span>
              {" / "}
              {totalQuestions} checked ·{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {correctCount} correct
              </span>
              {checkedCount > correctCount ? (
                <>
                  {" · "}
                  <span className="text-rose-700 dark:text-rose-400">
                    {incorrectCount} to review
                  </span>
                </>
              ) : null}
            </p>
            {mcqList.length > 0 && shortList.length > 0 && !allChecked ? (
              <p className="text-[11px] text-muted-foreground/90">
                Use both tabs so every question is checked — then you’ll see the
                full round summary.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {!retryMode && wrongInNotebook > 0 ? (
              <Link
                href={`${base}/quiz?retry=1`}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "gap-1.5"
                )}
              >
                <RotateCcw className="size-3.5" />
                Retry wrong ({wrongInNotebook})
              </Link>
            ) : null}
            <Link
              href={`${base}/mistakes`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Notebook
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground">How this quiz works</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Multiple choice checks as soon as you select an option. Short answers use
          “Check answer” when you’re ready. Wrong responses are saved to your
          mistake notebook with this subject and document id.
        </p>
        <p className="mt-2 font-medium text-foreground">Quiz source</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>Origin</dt>
          <dd className="capitalize">
            {selectedDocument.quizSource === "openai"
              ? "OpenAI (document text)"
              : selectedDocument.quizSource === "heuristic"
                ? "Rule-based (document text)"
                : selectedDocument.quizSource === "legacy-mock"
                  ? "Legacy demo"
                  : "Unknown"}
          </dd>
          <dt>Document</dt>
          <dd className="truncate font-medium text-foreground">
            {selectedDocument.fileName}
          </dd>
          <dt>Subject id</dt>
          <dd className="font-mono text-[10px]">{subjectId}</dd>
          <dt>Document id</dt>
          <dd className="font-mono text-[10px]">{selectedDocument.id}</dd>
        </dl>
      </div>

      <Tabs defaultValue="mcq" className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="mcq">
            Multiple choice ({mcqList.length})
          </TabsTrigger>
          <TabsTrigger value="short">
            Short answer ({shortList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mcq" className="mt-6 space-y-6">
          {mcqList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No multiple-choice items in this session.
            </p>
          ) : (
            mcqList.map((q, idx) => (
              <McqBlock
                key={q.id}
                indexLabel={`${idx + 1} / ${mcqList.length}`}
                q={q}
                value={mcqAnswers[q.id]}
                onPickOption={(v) => handleMcqPick(q, v)}
                checked={checked[q.id]}
                checkHint={checkHints[q.id]}
                notebookHref={`${base}/mistakes`}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="short" className="mt-6 space-y-6">
          {shortList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No short-answer items in this session.
            </p>
          ) : (
            shortList.map((q, idx) => (
              <ShortBlock
                key={q.id}
                indexLabel={`${idx + 1} / ${shortList.length}`}
                q={q}
                value={shortAnswers[q.id] ?? ""}
                onChange={(v) => setShortResponse(q.id, v)}
                checked={checked[q.id]}
                checkHint={checkHints[q.id]}
                onCheck={() => runCheckShort(q)}
                notebookHref={`${base}/mistakes`}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {allChecked ? (
        <div
          className="rounded-xl border border-border/80 bg-card p-5 shadow-sm"
          role="region"
          aria-label="Quiz results summary"
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Round complete
              </h2>
              <p className="text-sm text-muted-foreground">
                You checked every question in this session. Scores are based on
                your checks and, for short answers, overlap with key terms in the
                model answer.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Checked
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {checkedCount}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {totalQuestions}
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.08] px-3 py-2 dark:bg-emerald-500/10">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
                Correct
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                {correctCount}
              </dd>
            </div>
            <div className="rounded-lg bg-rose-500/[0.06] px-3 py-2 dark:bg-rose-500/10">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-rose-800/80 dark:text-rose-200/80">
                Incorrect
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-rose-900 dark:text-rose-100">
                {incorrectCount}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {incorrectCount > 0 ? (
              <Link
                href={`${base}/quiz?retry=1`}
                className={cn(buttonVariants(), "gap-1.5")}
              >
                <RotateCcw className="size-3.5" />
                Retry {incorrectCount} wrong
              </Link>
            ) : null}
            <Link
              href={`${base}/mistakes`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open mistake notebook
            </Link>
            <Link
              href={`${base}/quiz`}
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              New full run
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function McqBlock({
  q,
  indexLabel,
  value,
  onPickOption,
  checked,
  checkHint,
  notebookHref,
}: {
  q: QuizQuestionMCQ;
  indexLabel: string;
  value: string | undefined;
  onPickOption: (v: string) => void;
  checked: { correct: boolean } | undefined;
  checkHint: string | undefined;
  notebookHref: string;
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">
          {q.question}
        </p>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {indexLabel}
        </span>
      </div>
      <Badge variant="outline" className="mt-2 font-normal text-[10px]">
        {q.conceptTag}
      </Badge>
      <ul className="mt-4 space-y-1.5" role="radiogroup" aria-label="Choices">
        {q.options.map((opt) => {
          const selected = value === opt;
          const showResult = !!checked;
          const isCorrectOption = opt === q.correctAnswer;
          const highlightWrong =
            showResult && selected && !checked?.correct && !isCorrectOption;
          const highlightCorrect = showResult && isCorrectOption;
          return (
            <li key={opt}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2.5 text-sm transition-colors",
                  "border-transparent hover:bg-muted/45",
                  selected && !showResult && "border-primary/35 bg-accent/30",
                  highlightCorrect &&
                    "border-emerald-300/80 bg-emerald-500/[0.07] dark:border-emerald-700",
                  highlightWrong &&
                    "border-rose-300/70 bg-rose-500/[0.06] dark:border-rose-800"
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="mt-1 size-3.5 shrink-0 border-muted-foreground/40"
                  checked={selected}
                  onChange={() => onPickOption(opt)}
                  aria-checked={selected}
                />
                <span className="leading-relaxed">{opt}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {checkHint ? (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90">
          {checkHint}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        Selecting an option checks your answer right away and updates your
        mistake notebook when needed.
      </p>
      {checked ? (
        <FeedbackPanel
          correct={checked.correct}
          correctLabel="Correct answer"
          correctText={q.correctAnswer}
          explanation={q.explanation}
          notebookHref={notebookHref}
        />
      ) : null}
    </article>
  );
}

function ShortBlock({
  q,
  indexLabel,
  value,
  onChange,
  checked,
  checkHint,
  onCheck,
  notebookHref,
}: {
  q: QuizQuestionShort;
  indexLabel: string;
  value: string;
  onChange: (v: string) => void;
  checked: { correct: boolean } | undefined;
  checkHint: string | undefined;
  onCheck: () => void;
  notebookHref: string;
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">
          {q.question}
        </p>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {indexLabel}
        </span>
      </div>
      <Badge variant="outline" className="mt-2 font-normal text-[10px]">
        {q.conceptTag}
      </Badge>
      <textarea
        className="mt-4 min-h-[108px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a concise answer in your own words…"
        aria-label="Your answer"
      />
      {checkHint ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90">
          {checkHint}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onCheck}>
          Check answer
        </Button>
      </div>
      {checked ? (
        <FeedbackPanel
          correct={checked.correct}
          correctLabel="Model answer"
          correctText={q.correctAnswer}
          explanation={q.explanation}
          notebookHref={notebookHref}
        />
      ) : null}
    </article>
  );
}

function FeedbackPanel({
  correct,
  correctLabel,
  correctText,
  explanation,
  notebookHref,
}: {
  correct: boolean;
  correctLabel: string;
  correctText: string;
  explanation: string;
  notebookHref: string;
}) {
  return (
    <div
      className={cn(
        "mt-4 space-y-3 rounded-lg border p-4",
        correct
          ? "border-emerald-200/90 bg-emerald-500/[0.06] dark:border-emerald-800 dark:bg-emerald-950/25"
          : "border-rose-200/90 bg-rose-500/[0.05] dark:border-rose-900 dark:bg-rose-950/20"
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        {correct ? (
          <CheckCircle2
            className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : (
          <XCircle
            className="size-5 shrink-0 text-rose-600 dark:text-rose-400"
            aria-hidden
          />
        )}
        <p className="text-sm font-semibold text-foreground">
          {correct ? "Correct — well done" : "Not quite — compare with the model"}
        </p>
      </div>
      <div className="space-y-1 rounded-md bg-background/60 px-3 py-2 dark:bg-background/20">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {correctLabel}
        </p>
        <p className="text-sm leading-relaxed text-foreground">{correctText}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Explanation
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      </div>
      {!correct ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            Saved to your mistake notebook
          </span>
          {" — "}
          <Link
            href={notebookHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Review entries
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
