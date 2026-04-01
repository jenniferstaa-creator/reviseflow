"use client";

import * as React from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  ScrollText,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  MockPracticeQuestion,
  PracticeQuestionType,
  StudyPracticeMode,
  StudyPracticeQuestion,
} from "@/data/types";
import {
  PracticeQuestionAnswerInput,
  SelectionResultBadge,
} from "@/components/practice-question-answer";
import {
  buildDocumentDigests,
  formatSubjectContextBlock,
  mistakesDigestForPlanning,
} from "@/lib/planning-payload";
import { buildStudyPracticeBundle } from "@/lib/study-practice-payload";
import { selectionsRoughlyMatch } from "@/lib/practice-question-classify";
import { newId } from "@/lib/workspace-reducer";

function typeBadgeLabel(t: PracticeQuestionType): string {
  switch (t) {
    case "true_false":
      return "True / false";
    case "multiple_choice":
      return "Multiple choice";
    case "short_answer":
      return "Short answer";
    default:
      return "Written";
  }
}

const MODE_OPTIONS: {
  value: StudyPracticeMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "quick_check",
    label: "Quick check",
    hint: "Short concept questions you can answer in a few lines.",
  },
  {
    value: "exam_style",
    label: "Exam-style practice",
    hint: "Longer explain / compare / apply prompts.",
  },
  {
    value: "weak_area_drill",
    label: "Weak-area drill",
    hint: "Targets mistakes, weak topics, and shaky mastery signals.",
  },
];

function formatStudySetTitle(
  mode: StudyPracticeMode,
  scope: "single" | "all",
  docLabel: string | null
): string {
  const m =
    mode === "quick_check"
      ? "Quick check"
      : mode === "exam_style"
        ? "Exam-style"
        : "Weak-area drill";
  const s = scope === "all" ? "All materials" : docLabel ?? "One PDF";
  return `${m} · ${s}`;
}

export default function MockPracticePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:px-6">
      <header className="space-y-2 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-muted/40">
            <ScrollText className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Written practice
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate questions from your lecture PDFs, or upload a past paper.
              Answer first—then reveal model wording and coaching.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="materials" className="mt-6 w-full">
        <TabsList variant="line" className="w-full justify-start gap-1">
          <TabsTrigger value="materials" className="gap-1.5">
            <Sparkles className="size-3.5 opacity-70" />
            From your PDFs
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-1.5">
            <ScrollText className="size-3.5 opacity-70" />
            Past paper
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-6">
          <StudyMaterialsPane />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <PastPaperPane />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudyMaterialsPane() {
  const {
    subject,
    documents,
    mistakes,
    selectedDocumentId,
    addStudyPracticeSet,
    deleteStudyPracticeSet,
    updateStudyPracticeQuestion,
  } = useSubjectWorkspace();

  const sets = subject.studyPracticeSets ?? [];
  const readyWithText = React.useMemo(
    () =>
      documents.filter(
        (d) =>
          d.status === "ready" &&
          d.parseSucceeded &&
          d.extractedText.trim().length > 0
      ),
    [documents]
  );

  const [mode, setMode] = React.useState<StudyPracticeMode>("quick_check");
  const [scope, setScope] = React.useState<"single" | "all">("all");
  const [singleDocId, setSingleDocId] = React.useState<string>(() => {
    const fromSel = documents.find((d) => d.id === selectedDocumentId);
    if (
      fromSel?.status === "ready" &&
      fromSel.parseSucceeded &&
      fromSel.extractedText.trim()
    ) {
      return fromSel.id;
    }
    const first = documents.find(
      (d) =>
        d.status === "ready" &&
        d.parseSucceeded &&
        d.extractedText.trim().length > 0
    );
    return first?.id ?? "";
  });

  React.useEffect(() => {
    if (singleDocId && readyWithText.some((d) => d.id === singleDocId)) return;
    setSingleDocId(readyWithText[0]?.id ?? "");
  }, [readyWithText, singleDocId]);

  const [selectedSetId, setSelectedSetId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (selectedSetId && sets.some((s) => s.id === selectedSetId)) return;
    setSelectedSetId(sets[0]?.id ?? null);
  }, [sets, selectedSetId]);

  const selectedSet =
    sets.find((s) => s.id === selectedSetId) ?? sets[0] ?? null;

  const [genLoading, setGenLoading] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  const subjectContext = React.useMemo(
    () =>
      formatSubjectContextBlock({
        subjectName: subject.name,
        documents: buildDocumentDigests(documents),
        mistakes: mistakesDigestForPlanning(mistakes),
        subjectAnalysis: subject.subjectAnalysis,
      }),
    [subject.name, documents, mistakes, subject.subjectAnalysis]
  );

  const singleFileName =
    readyWithText.find((d) => d.id === singleDocId)?.fileName ?? null;

  const onGenerate = async () => {
    setGenError(null);
    const sourceId = scope === "single" ? singleDocId || null : null;
    if (scope === "single" && !sourceId) {
      setGenError("Choose a PDF for single-file practice.");
      return;
    }
    const bundle = buildStudyPracticeBundle(subject, scope, sourceId);
    if (bundle.documents.length === 0) {
      setGenError(
        "No PDFs with extracted text yet. Upload materials on Files & upload and wait until they are ready."
      );
      return;
    }

    setGenLoading(true);
    try {
      const res = await fetch("/api/generate-study-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          scope,
          sourceDocumentId: sourceId,
          bundle,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        questions?: Array<{
          prompt: string;
          questionType: PracticeQuestionType;
          options: string[];
          correctAnswer: string | null;
          marks: number | null;
          source: string;
          suggestedAnswer: string;
          keyPoints: string[];
          sourceDocumentId: string | null;
        }>;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.questions?.length) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not generate questions."
        );
      }

      const setId = newId("sset");
      const now = new Date().toISOString();
      addStudyPracticeSet({
        id: setId,
        createdAt: now,
        mode,
        scope,
        sourceDocumentId: sourceId,
        title: formatStudySetTitle(
          mode,
          scope,
          scope === "all" ? null : singleFileName
        ),
        questions: data.questions.map((q) => ({
          id: newId("sq"),
          prompt: q.prompt,
          questionType: q.questionType,
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswer:
            q.correctAnswer === null || typeof q.correctAnswer === "string"
              ? q.correctAnswer
              : null,
          marks:
            typeof q.marks === "number" && Number.isFinite(q.marks)
              ? q.marks
              : null,
          source: q.source,
          sourceDocumentId: q.sourceDocumentId,
          suggestedAnswer: q.suggestedAnswer,
          keyPoints: q.keyPoints,
          userAnswer: "",
          selectionIsCorrect: null,
          revealedAnswer: false,
          revealedKeyPoints: false,
          feedback: null,
          strongerPhrasing: null,
          markedDifficult: false,
          savedForLater: false,
          evaluatedAt: null,
        })),
      });
      setSelectedSetId(setId);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  };

  const weakSignalThin =
    mistakes.length === 0 &&
    !(subject.subjectAnalysis?.weakestAreas?.length) &&
    mode === "weak_area_drill";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 space-y-4 lg:w-64">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 opacity-70" />
              Generate from materials
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Uses extracted PDF text, summaries, exam topics, mistakes, and
              weak-area signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Mode
              </p>
              <div className="flex flex-col gap-2">
                {MODE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                      mode === opt.value
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="study-mode"
                      className="mt-0.5"
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block font-normal text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Separator className="opacity-60" />

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Scope
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="study-scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All PDFs in this subject
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="study-scope"
                  checked={scope === "single"}
                  onChange={() => setScope("single")}
                />
                Single PDF
              </label>
              {scope === "single" ? (
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-xs"
                  value={singleDocId}
                  onChange={(e) => setSingleDocId(e.target.value)}
                  disabled={readyWithText.length === 0}
                >
                  {readyWithText.length === 0 ? (
                    <option value="">No usable PDFs</option>
                  ) : (
                    readyWithText.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fileName}
                      </option>
                    ))
                  )}
                </select>
              ) : null}
            </div>

            {weakSignalThin ? (
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/85">
                No mistakes or weak-area list yet—questions will still be built
                from your PDFs and summaries. Use the quiz or refresh course
                insights for sharper weak-area drills later.
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full gap-2"
              disabled={genLoading || readyWithText.length === 0}
              onClick={onGenerate}
            >
              {genLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="size-4 opacity-80" />
                  Generate session
                </>
              )}
            </Button>
            {genError ? (
              <p className="text-xs text-destructive">{genError}</p>
            ) : null}
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Saved sessions
          </p>
          {sets.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Generated sets appear here so you can revisit them.
            </p>
          ) : (
            <ul className="space-y-1">
              {sets.map((st) => {
                const active = st.id === selectedSet?.id;
                return (
                  <li key={st.id}>
                    <div
                      className={cn(
                        "group flex items-start gap-1 rounded-lg border px-2 py-2 text-left text-xs transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left font-medium text-foreground"
                        onClick={() => setSelectedSetId(st.id)}
                      >
                        <span className="line-clamp-2">{st.title}</span>
                        <span className="mt-0.5 block font-normal text-muted-foreground">
                          {st.questions.length} questions ·{" "}
                          {new Date(st.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
                        aria-label="Remove session"
                        onClick={() => {
                          deleteStudyPracticeSet(st.id);
                          if (selectedSetId === st.id) {
                            setSelectedSetId(null);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <BookOpen className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <span>
            Each card shows its <strong className="font-medium">source</strong>
            . Try the question closed-book, then reveal the model answer and key
            points when you are ready.
          </span>
        </p>

        {!selectedSet ? (
          <Card className="border-dashed border-border/80">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {readyWithText.length === 0
                ? "Upload PDFs and wait until they finish processing to generate practice."
                : "Pick options on the left and generate a session."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {selectedSet.questions.map((q, idx) => (
              <StudyGeneratedQuestionCard
                key={q.id}
                setId={selectedSet.id}
                index={idx + 1}
                total={selectedSet.questions.length}
                mode={selectedSet.mode}
                question={q}
                subjectName={subject.name}
                subjectContext={subjectContext}
                updateStudyPracticeQuestion={updateStudyPracticeQuestion}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudyGeneratedQuestionCard({
  setId,
  index,
  total,
  mode,
  question,
  subjectName,
  subjectContext,
  updateStudyPracticeQuestion,
}: {
  setId: string;
  index: number;
  total: number;
  mode: StudyPracticeMode;
  question: StudyPracticeQuestion;
  subjectName: string;
  subjectContext: string;
  updateStudyPracticeQuestion: (
    setId: string,
    questionId: string,
    patch: Partial<StudyPracticeQuestion>
  ) => void;
}) {
  const [expandedCoach, setExpandedCoach] = React.useState(false);
  const [evalLoading, setEvalLoading] = React.useState(false);
  const [evalError, setEvalError] = React.useState<string | null>(null);

  const modeShort =
    mode === "quick_check"
      ? "Quick check"
      : mode === "exam_style"
        ? "Exam-style"
        : "Weak-area";

  const isSelection =
    question.questionType === "true_false" ||
    question.questionType === "multiple_choice";

  const onAnswer = (value: string) => {
    const sel =
      isSelection && question.correctAnswer && value.trim().length > 0
        ? selectionsRoughlyMatch(value, question.correctAnswer)
        : null;
    updateStudyPracticeQuestion(setId, question.id, {
      userAnswer: value,
      selectionIsCorrect: sel,
    });
  };

  const runCoaching = async () => {
    setEvalError(null);
    setEvalLoading(true);
    try {
      const res = await fetch("/api/mock-practice-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: question.prompt,
          userAnswer: question.userAnswer,
          subjectName,
          subjectContext,
          questionType: question.questionType,
          options:
            question.questionType === "multiple_choice"
              ? question.options
              : question.questionType === "true_false"
                ? ["True", "False"]
                : [],
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: string;
        strongerPhrasing?: string;
        isCorrect?: boolean | null;
        correctAnswer?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Coaching request failed"
        );
      }
      const patch: Partial<StudyPracticeQuestion> = {
        feedback: data.feedback ?? null,
        strongerPhrasing: data.strongerPhrasing ?? null,
        evaluatedAt: new Date().toISOString(),
      };
      if (isSelection && typeof data.isCorrect === "boolean") {
        patch.selectionIsCorrect = data.isCorrect;
      }
      if (
        isSelection &&
        data.correctAnswer !== undefined &&
        (data.correctAnswer === null ||
          typeof data.correctAnswer === "string")
      ) {
        const t =
          typeof data.correctAnswer === "string"
            ? data.correctAnswer.trim()
            : "";
        patch.correctAnswer = t.length ? t : null;
      }
      updateStudyPracticeQuestion(setId, question.id, patch);
      setExpandedCoach(true);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setEvalLoading(false);
    }
  };

  const showCompareHelp =
    question.revealedAnswer &&
    question.userAnswer.trim().length > 0 &&
    question.suggestedAnswer.trim().length > 0;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px]">
              {index} / {total}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {modeShort}
            </Badge>
            <Badge variant="outline" className="max-w-[220px] truncate text-[10px] font-normal">
              Source: {question.source || "—"}
            </Badge>
            {question.marks != null ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {question.marks} marks
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px] font-normal">
              {typeBadgeLabel(question.questionType)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={question.markedDifficult ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateStudyPracticeQuestion(setId, question.id, {
                  markedDifficult: !question.markedDifficult,
                })
              }
            >
              {question.markedDifficult ? "Difficult · on" : "Mark difficult"}
            </Button>
            <Button
              type="button"
              variant={question.savedForLater ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateStudyPracticeQuestion(setId, question.id, {
                  savedForLater: !question.savedForLater,
                })
              }
            >
              {question.savedForLater ? "Saved" : "Save for later"}
            </Button>
          </div>
        </div>
        <CardTitle className="text-base font-normal leading-relaxed text-foreground">
          {question.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <PracticeQuestionAnswerInput
          questionType={question.questionType}
          options={question.options}
          userAnswer={question.userAnswer}
          onUserAnswer={onAnswer}
          disabled={evalLoading}
          idPrefix={`sg-${question.id}`}
          label="Your response"
        />
        <div className="flex flex-wrap items-center gap-2">
          <SelectionResultBadge
            selectionIsCorrect={question.selectionIsCorrect}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={question.revealedAnswer ? "secondary" : "outline"}
            size="sm"
            onClick={() =>
              updateStudyPracticeQuestion(setId, question.id, {
                revealedAnswer: !question.revealedAnswer,
              })
            }
          >
            {question.revealedAnswer ? "Hide model answer" : "Reveal model answer"}
          </Button>
          <Button
            type="button"
            variant={question.revealedKeyPoints ? "secondary" : "outline"}
            size="sm"
            onClick={() =>
              updateStudyPracticeQuestion(setId, question.id, {
                revealedKeyPoints: !question.revealedKeyPoints,
              })
            }
          >
            {question.revealedKeyPoints
              ? "Hide key points"
              : "Reveal key points"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={evalLoading}
            onClick={runCoaching}
          >
            {evalLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                …
              </>
            ) : (
              "Compare & get coaching"
            )}
          </Button>
          {(question.feedback || question.strongerPhrasing) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setExpandedCoach((v) => !v)}
            >
              {expandedCoach ? (
                <>
                  Hide coaching <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  Show coaching <ChevronDown className="size-3.5" />
                </>
              )}
            </Button>
          ) : null}
        </div>

        {evalError ? (
          <p className="text-sm text-destructive">{evalError}</p>
        ) : null}

        {question.revealedAnswer || question.revealedKeyPoints ? (
          <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
            {question.revealedAnswer ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Model answer
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {question.suggestedAnswer}
                </p>
              </div>
            ) : null}
            {question.revealedKeyPoints && question.keyPoints.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Key points
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                  {question.keyPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showCompareHelp ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Skim your paragraph above against the model answer—coaching
                explains gaps in your wording.
              </p>
            ) : null}

            {expandedCoach && (question.feedback || question.strongerPhrasing) ? (
              <>
                <Separator className="opacity-60" />
                {question.feedback ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Feedback on your answer
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {question.feedback}
                    </p>
                  </div>
                ) : null}
                {question.strongerPhrasing ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Stronger exam phrasing
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {question.strongerPhrasing}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PastPaperPane() {
  const {
    subject,
    documents,
    mistakes,
    addMockPracticePaperFromFile,
    deleteMockPracticePaper,
    updateMockPracticeQuestion,
  } = useSubjectWorkspace();

  const papers = subject.mockPracticePapers ?? [];
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedPaperId, setSelectedPaperId] = React.useState<string | null>(
    null
  );
  React.useEffect(() => {
    if (selectedPaperId && papers.some((p) => p.id === selectedPaperId)) return;
    const first = papers.find((p) => p.status === "ready") ?? papers[0];
    setSelectedPaperId(first?.id ?? null);
  }, [papers, selectedPaperId]);

  const selectedPaper =
    papers.find((p) => p.id === selectedPaperId) ?? papers[0] ?? null;

  const subjectContext = React.useMemo(
    () =>
      formatSubjectContextBlock({
        subjectName: subject.name,
        documents: buildDocumentDigests(documents),
        mistakes: mistakesDigestForPlanning(mistakes),
        subjectAnalysis: subject.subjectAnalysis,
      }),
    [subject.name, documents, mistakes, subject.subjectAnalysis]
  );

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) addMockPracticePaperFromFile(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 size-3.5 shrink-0 opacity-70" />
        <span>
          Upload a real past paper or exam PDF. We split it into questions;{" "}
          <strong className="font-medium">model answers</strong> use AI with
          your subject context—not official mark schemes.
        </span>
      </p>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 space-y-3 lg:w-56">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={onPickFile}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2 border-dashed"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4 opacity-70" />
            Upload past paper
          </Button>
          {papers.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Optional—use when you have a paper file. Otherwise use{" "}
              <strong className="font-medium">From your PDFs</strong>.
            </p>
          ) : (
            <ul className="space-y-1">
              {papers.map((p) => {
                const active = p.id === selectedPaper?.id;
                return (
                  <li key={p.id}>
                    <div
                      className={cn(
                        "group flex items-start gap-1 rounded-lg border px-2 py-2 text-left text-xs transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left font-medium text-foreground"
                        onClick={() => setSelectedPaperId(p.id)}
                      >
                        <span className="line-clamp-2">{p.fileName}</span>
                        <span className="mt-0.5 block font-normal text-muted-foreground">
                          {p.status === "ready"
                            ? `${p.questions.length} questions`
                            : p.status === "error"
                              ? "Failed"
                              : p.analysisStep ?? "Working…"}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground opacity-60 hover:opacity-100"
                        aria-label={`Remove ${p.fileName}`}
                        onClick={() => {
                          deleteMockPracticePaper(p.id);
                          if (selectedPaperId === p.id) {
                            setSelectedPaperId(null);
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          {!selectedPaper ? null : selectedPaper.status === "uploading" ||
            selectedPaper.status === "analyzing" ? (
            <Card className="border-border/70">
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {selectedPaper.analysisStep ?? "Processing…"}
                </p>
              </CardContent>
            </Card>
          ) : selectedPaper.status === "error" ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base">Could not process PDF</CardTitle>
                <CardDescription>
                  {selectedPaper.errorMessage ??
                    "Try another file or check the PDF has selectable text."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              {selectedPaper.questions.map((q, idx) => (
                <PastPaperQuestionCard
                  key={q.id}
                  index={idx + 1}
                  total={selectedPaper.questions.length}
                  paperId={selectedPaper.id}
                  question={q}
                  subjectName={subject.name}
                  subjectContext={subjectContext}
                  updateMockPracticeQuestion={updateMockPracticeQuestion}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PastPaperQuestionCard({
  index,
  total,
  paperId,
  question,
  subjectName,
  subjectContext,
  updateMockPracticeQuestion,
}: {
  index: number;
  total: number;
  paperId: string;
  question: MockPracticeQuestion;
  subjectName: string;
  subjectContext: string;
  updateMockPracticeQuestion: (
    paperId: string,
    questionId: string,
    patch: Partial<MockPracticeQuestion>
  ) => void;
}) {
  const [expandedCoach, setExpandedCoach] = React.useState(false);
  const [evalLoading, setEvalLoading] = React.useState(false);
  const [evalError, setEvalError] = React.useState<string | null>(null);

  const hasReveal =
    Boolean(question.suggestedAnswer) || question.keyPoints.length > 0;

  const isSelection =
    question.questionType === "true_false" ||
    question.questionType === "multiple_choice";

  const onAnswer = (value: string) => {
    updateMockPracticeQuestion(paperId, question.id, {
      userAnswer: value,
      selectionIsCorrect: null,
    });
  };

  const runEvaluate = async () => {
    setEvalError(null);
    setEvalLoading(true);
    try {
      const res = await fetch("/api/mock-practice-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: question.prompt,
          userAnswer: question.userAnswer,
          subjectName,
          subjectContext,
          questionType: question.questionType,
          options:
            question.questionType === "multiple_choice"
              ? question.options
              : question.questionType === "true_false"
                ? ["True", "False"]
                : [],
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        suggestedAnswer?: string;
        keyPoints?: string[];
        feedback?: string;
        strongerPhrasing?: string;
        isCorrect?: boolean | null;
        correctAnswer?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Evaluation failed"
        );
      }
      const patch: Partial<MockPracticeQuestion> = {
        suggestedAnswer: data.suggestedAnswer ?? null,
        keyPoints: data.keyPoints ?? [],
        feedback: data.feedback ?? null,
        strongerPhrasing: data.strongerPhrasing ?? null,
        evaluatedAt: new Date().toISOString(),
      };
      if (isSelection && typeof data.isCorrect === "boolean") {
        patch.selectionIsCorrect = data.isCorrect;
      }
      if (
        isSelection &&
        data.correctAnswer !== undefined &&
        (data.correctAnswer === null ||
          typeof data.correctAnswer === "string")
      ) {
        const t =
          typeof data.correctAnswer === "string"
            ? data.correctAnswer.trim()
            : "";
        patch.correctAnswer = t.length ? t : null;
      }
      updateMockPracticeQuestion(paperId, question.id, patch);
      setExpandedCoach(false);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setEvalLoading(false);
    }
  };

  const checkLabel =
    question.questionType === "true_false" ||
    question.questionType === "multiple_choice"
      ? "Check answer & model solution"
      : "Model answer & key points";

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px]">
              Question {index} / {total}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              Past paper extract
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {typeBadgeLabel(question.questionType)}
            </Badge>
            {question.source ? (
              <Badge
                variant="outline"
                className="max-w-[200px] truncate text-[10px] font-normal"
              >
                {question.source}
              </Badge>
            ) : null}
            {question.marks != null ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {question.marks} marks
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={question.markedDifficult ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateMockPracticeQuestion(paperId, question.id, {
                  markedDifficult: !question.markedDifficult,
                })
              }
            >
              {question.markedDifficult ? "Difficult · on" : "Mark difficult"}
            </Button>
            <Button
              type="button"
              variant={question.savedForLater ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() =>
                updateMockPracticeQuestion(paperId, question.id, {
                  savedForLater: !question.savedForLater,
                })
              }
            >
              {question.savedForLater ? "Saved" : "Save for later"}
            </Button>
          </div>
        </div>
        <CardTitle className="text-base font-normal leading-relaxed text-foreground">
          {question.prompt}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <PracticeQuestionAnswerInput
          questionType={question.questionType}
          options={question.options}
          userAnswer={question.userAnswer}
          onUserAnswer={onAnswer}
          disabled={evalLoading}
          idPrefix={`mp-${question.id}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SelectionResultBadge
            selectionIsCorrect={question.selectionIsCorrect}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={
              evalLoading ||
              (isSelection && !String(question.userAnswer ?? "").trim())
            }
            onClick={runEvaluate}
          >
            {evalLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking…
              </>
            ) : (
              checkLabel
            )}
          </Button>
          {hasReveal && (question.feedback || question.strongerPhrasing) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setExpandedCoach((v) => !v)}
            >
              {expandedCoach ? (
                <>
                  Hide coaching detail <ChevronUp className="size-3.5" />
                </>
              ) : (
                <>
                  Compare & coaching <ChevronDown className="size-3.5" />
                </>
              )}
            </Button>
          ) : null}
        </div>

        {evalError ? (
          <p className="text-sm text-destructive">{evalError}</p>
        ) : null}

        {hasReveal ? (
          <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested answer
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {question.suggestedAnswer}
              </p>
            </div>
            {question.keyPoints.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Key points for full marks
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
                  {question.keyPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {expandedCoach && (question.feedback || question.strongerPhrasing) ? (
              <>
                <Separator className="opacity-60" />
                {question.feedback ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Feedback on your answer
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {question.feedback}
                    </p>
                  </div>
                ) : null}
                {question.strongerPhrasing ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Stronger exam phrasing
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {question.strongerPhrasing}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
