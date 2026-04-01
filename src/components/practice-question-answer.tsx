"use client";

import { cn } from "@/lib/utils";
import type { PracticeQuestionType } from "@/data/types";
import { Button } from "@/components/ui/button";

type Props = {
  questionType: PracticeQuestionType;
  /** Multiple-choice labels (ignored for true_false — fixed True/False). */
  options: string[];
  userAnswer: string;
  onUserAnswer: (value: string) => void;
  disabled?: boolean;
  idPrefix: string;
  label?: string;
};

export function PracticeQuestionAnswerInput({
  questionType,
  options,
  userAnswer,
  onUserAnswer,
  disabled,
  idPrefix,
  label = "Your answer",
}: Props) {
  if (questionType === "true_false" || questionType === "multiple_choice") {
    const labels =
      questionType === "true_false" ? ["True", "False"] : options;

    if (questionType === "multiple_choice" && labels.length < 2) {
      return (
        <div>
          <label
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            htmlFor={`${idPrefix}-fallback`}
          >
            {label}
          </label>
          <textarea
            id={`${idPrefix}-fallback`}
            className="min-h-[120px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={userAnswer}
            onChange={(e) => onUserAnswer(e.target.value)}
            disabled={disabled}
            placeholder="Answer in your own words…"
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label} —{" "}
          {questionType === "true_false" ? "True or false" : "Select one"}
        </p>
        <div
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          role="group"
          aria-label={questionType === "true_false" ? "True or false" : "Choices"}
        >
          {labels.map((choice) => {
            const selected = userAnswer === choice;
            return (
              <Button
                key={choice}
                type="button"
                variant={selected ? "secondary" : "outline"}
                className={cn(
                  "h-auto min-h-11 max-w-full justify-start whitespace-normal px-4 py-2.5 text-left text-sm font-normal leading-snug",
                  selected && "ring-2 ring-primary/45"
                )}
                disabled={disabled}
                onClick={() => onUserAnswer(choice)}
              >
                {choice}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  const isShort = questionType === "short_answer";

  return (
    <div>
      <label
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        htmlFor={`${idPrefix}-ta`}
      >
        {label}
        {isShort ? " — short response" : " — extended response"}
      </label>
      <textarea
        id={`${idPrefix}-ta`}
        className={cn(
          "w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring",
          isShort ? "min-h-[96px]" : "min-h-[152px]"
        )}
        value={userAnswer}
        onChange={(e) => onUserAnswer(e.target.value)}
        disabled={disabled}
        placeholder={
          isShort
            ? "A few sentences…"
            : "Structure your answer as you would in the exam…"
        }
      />
    </div>
  );
}

export function SelectionResultBadge({
  selectionIsCorrect,
}: {
  selectionIsCorrect: boolean | null;
}) {
  if (selectionIsCorrect === null) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
        selectionIsCorrect
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : "border-rose-500/35 bg-rose-500/10 text-rose-900 dark:text-rose-100"
      )}
    >
      {selectionIsCorrect ? "Correct" : "Incorrect"}
    </div>
  );
}
