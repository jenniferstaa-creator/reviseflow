"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
  FileUp,
  X,
} from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { formatIsoDateLongEn } from "@/lib/dates";
import type { StudyDocument } from "@/data/types";
import {
  DocumentSortToolbar,
  documentStatusSortRank,
  sortStudyDocuments,
  type DocumentSortKey,
} from "@/components/document-sort-toolbar";
import { MAX_SUMMARY_INPUT_CHARS } from "@/lib/summary-api";
import { MAX_QUIZ_INPUT_CHARS } from "@/lib/quiz-api";
import {
  MAX_EXTRACTED_TEXT_STORED,
  MIN_EXTRACT_MEANINGFUL_CHARS,
} from "@/lib/pdf-constants";
import { DocumentAnalysisBadge } from "@/components/document-analysis-status";

function canRetryAnalysis(d: StudyDocument, anyBusy: boolean): boolean {
  if (anyBusy) return false;
  if (!d.parseSucceeded || !d.extractedText.trim()) return false;
  if (d.status === "uploading" || d.status === "analyzing") return false;
  if (d.status === "error") return false;
  if (d.extractTooShort) return false;
  return !!(d.summaryError || d.quizError || d.errorMessage);
}

/** Confirms parse layer succeeded; separate from OpenAI success/failure. */
function ParseSuccessBanner({ d }: { d: StudyDocument }) {
  if (!d.parseSucceeded || !d.extractedText.trim()) return null;
  if (d.status === "uploading" || d.status === "analyzing") return null;

  const aiIssue = !!(
    d.summaryError ||
    d.quizError ||
    d.errorMessage ||
    d.extractTooShort
  );

  return (
    <div className="border-t border-emerald-200/80 bg-emerald-500/[0.07] px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/25">
      <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
        PDF parsing succeeded
      </p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-100/85">
        {aiIssue
          ? "Text extraction finished successfully. Anything marked as a failure below refers to the AI summary or quiz step—not the PDF parser."
          : "Extracted text is saved and was used to build your materials."}
      </p>
    </div>
  );
}

/** Shown as soon as the server returns text — before or after AI steps. */
function ExtractedTextPreviewSection({ d }: { d: StudyDocument }) {
  const usesStructuredPreview = d.textPreview.length > 0;
  const preview = usesStructuredPreview
    ? d.textPreview
    : d.extractedText
      ? d.extractedText.slice(0, 1200)
      : "";

  if (!d.parseSucceeded || !preview) return null;

  const buildingMaterials = d.status === "analyzing" && d.parseSucceeded;
  const showMoreEllipsis =
    !usesStructuredPreview && d.extractedText.length > preview.length;
  const aiPartial =
    d.status === "ready" &&
    !!(d.summaryError || d.quizError || d.errorMessage) &&
    !d.extractTooShort;

  return (
    <div className="border-t border-border/60 bg-muted/20 px-4 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="size-4 shrink-0 text-primary" />
          Extracted text preview
        </div>
        {d.pageCount != null ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {d.pageCount} page{d.pageCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px] font-normal tabular-nums">
          {d.extractedText.length.toLocaleString()} chars
          {d.textTruncated ? " · stored cap" : ""}
        </Badge>
        {buildingMaterials ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin text-primary" />
            Building summary &amp; quiz from this text…
          </span>
        ) : d.status === "error" && d.parseSucceeded ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Extract saved · pipeline error
          </Badge>
        ) : d.status === "ready" ? (
          <div className="flex flex-wrap gap-1">
            <Badge variant="default" className="text-[10px] font-normal">
              Verified extract
            </Badge>
            {aiPartial ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                AI: partial
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mb-2 text-xs text-muted-foreground leading-relaxed">
        Read this opening extract to confirm the correct file was parsed. Summary
        and quiz use the full stored text, not just this preview.
      </p>
      <ScrollArea className="max-h-56 rounded-lg border border-primary/20 bg-background shadow-inner">
        <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-foreground/95">
          {preview}
          {showMoreEllipsis ? "\n\n…" : ""}
        </pre>
      </ScrollArea>
    </div>
  );
}

/** Pipeline + AI metadata for debugging (terminal logs complement this). */
function ParseDebugPanel({ d }: { d: StudyDocument }) {
  const legacy = d.contentSource === "legacy-mock";
  const defaultOpen =
    d.status === "error" ||
    !!d.pipelineErrorDetail ||
    !!d.summaryError ||
    !!d.quizError ||
    !!d.errorMessage;

  const metaJson =
    d.lastAnalysisMeta && Object.keys(d.lastAnalysisMeta).length > 0
      ? JSON.stringify(d.lastAnalysisMeta, null, 2)
      : null;

  return (
    <details
      className="rounded-b-lg border-t border-border/50 bg-muted/10 text-sm"
      open={defaultOpen}
    >
      <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground select-none hover:text-foreground">
        Technical details
      </summary>
      <div className="space-y-3 border-t border-border/40 px-4 py-3">
        <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <dt className="font-medium text-foreground">Failure stage</dt>
          <dd>
            {d.status === "error" && d.pipelineFailureStage ? (
              <span className="font-mono text-[11px] text-destructive">
                {d.pipelineFailureStage}
              </span>
            ) : d.summaryError && !d.quizError ? (
              <span className="text-amber-800 dark:text-amber-200/90">
                summary_openai (quiz OK or not run yet)
              </span>
            ) : d.quizError && d.quizSource === "heuristic" ? (
              <span className="text-amber-800 dark:text-amber-200/90">
                quiz_openai → heuristic fallback
              </span>
            ) : d.extractTooShort ? (
              <span className="text-amber-800 dark:text-amber-200/90">
                low_extract (&lt; {MIN_EXTRACT_MEANINGFUL_CHARS} chars)
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
          <dt className="font-medium text-foreground">PDF parse</dt>
          <dd>
            {d.status === "error" && !d.parseSucceeded ? (
              <span className="text-destructive">Failed</span>
            ) : d.parseSucceeded ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                Succeeded
              </span>
            ) : legacy ? (
              <span>Not stored (legacy)</span>
            ) : (
              <span>Pending</span>
            )}
          </dd>
          <dt className="font-medium text-foreground">Page count</dt>
          <dd className="tabular-nums">
            {d.pageCount != null ? d.pageCount : "—"}
          </dd>
          <dt className="font-medium text-foreground">Stored text length</dt>
          <dd className="tabular-nums">
            {d.extractedText.length > 0
              ? `${d.extractedText.length.toLocaleString()} chars${
                  d.textTruncated
                    ? ` (storage cap ${MAX_EXTRACTED_TEXT_STORED.toLocaleString()})`
                    : ""
                }`
              : "—"}
          </dd>
          <dt className="font-medium text-foreground">Length at parse</dt>
          <dd className="tabular-nums">
            {d.extractLengthAtParse != null
              ? `${d.extractLengthAtParse.toLocaleString()} chars (pre-storage trim)`
              : "—"}
          </dd>
          <dt className="font-medium text-foreground">OpenAI input caps</dt>
          <dd className="text-[11px] leading-snug">
            Summary model ≤ {MAX_SUMMARY_INPUT_CHARS.toLocaleString()} chars· Quiz
            model ≤ {MAX_QUIZ_INPUT_CHARS.toLocaleString()} chars (longer PDFs are
            truncated for the request; full stored text is kept up to the storage
            cap).
          </dd>
          <dt className="font-medium text-foreground">Readable threshold</dt>
          <dd className="text-[11px]">
            Below ~{MIN_EXTRACT_MEANINGFUL_CHARS} stored chars, AI summary is
            skipped as likely non-text PDF.
          </dd>
          <dt className="font-medium text-foreground">Summary (OpenAI)</dt>
          <dd>
            {d.summaryError ? (
              <span className="text-destructive">Failed or skipped</span>
            ) : d.summarySource === "openai" ? (
              <span className="text-emerald-700 dark:text-emerald-400">OK</span>
            ) : (
              <span>—</span>
            )}
          </dd>
          <dt className="font-medium text-foreground">Quiz (OpenAI)</dt>
          <dd>
            {d.quizSource === "openai" ? (
              <span className="text-emerald-700 dark:text-emerald-400">OK</span>
            ) : d.quizSource === "heuristic" ? (
              <span className="text-amber-800 dark:text-amber-200/90">
                Heuristic fallback
              </span>
            ) : (
              <span>—</span>
            )}
          </dd>
          <dt className="font-medium text-foreground">Source</dt>
          <dd className="capitalize">{d.contentSource ?? "extracted"}</dd>
        </dl>

        {d.pipelineErrorDetail ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
              Underlying error (pipeline)
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-destructive/95">
              {d.pipelineErrorDetail}
            </pre>
          </div>
        ) : null}

        {(d.parseErrorMessage || d.errorMessage) &&
        d.parseErrorMessage !== d.pipelineErrorDetail ? (
          <div className="rounded-md border border-border/80 bg-muted/30 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              User-facing / parse message
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">
              {d.parseErrorMessage ?? d.errorMessage}
            </pre>
          </div>
        ) : null}

        {d.summaryError ? (
          <div className="rounded-md border border-border/80 bg-muted/30 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Summary error (exact)
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">
              {d.summaryError}
            </pre>
          </div>
        ) : null}

        {d.quizError ? (
          <div className="rounded-md border border-border/80 bg-muted/30 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quiz error / fallback note (exact)
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]">
              {d.quizError}
            </pre>
          </div>
        ) : null}

        {metaJson ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Last AI request meta
            </p>
            <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-border/60 bg-background p-2 font-mono text-[10px] leading-relaxed">
              {metaJson}
            </pre>
          </div>
        ) : null}

        {legacy && !d.extractedText ? (
          <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
            This file was saved before real PDF extraction. Summary and quiz are
            demo placeholders—upload again to tie content to your PDF text.
          </p>
        ) : null}
      </div>
    </details>
  );
}

export default function SubjectUploadPage() {
  const {
    subjectId,
    subject,
    documents,
    addDocumentFromFile,
    retryDocumentAnalysis,
    deleteDocument,
    renameDocument,
    selectDocument,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [dragActive, setDragActive] = React.useState(false);
  const [docSort, setDocSort] = React.useState<DocumentSortKey>("date-desc");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const anyBusy = documents.some(
    (d) => d.status === "uploading" || d.status === "analyzing"
  );

  const sortedDocuments = React.useMemo(
    () =>
      sortStudyDocuments(
        documents,
        docSort,
        (d) => d.uploadedAt,
        (d) => d.fileName,
        (d) => documentStatusSortRank(d.status)
      ),
    [documents, docSort]
  );

  const mistakeCountByDoc = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const row of subject.mistakes) {
      m.set(row.documentId, (m.get(row.documentId) ?? 0) + 1);
    }
    return m;
  }, [subject.mistakes]);

  const addPdfFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter(
      (f) => f.type === "application/pdf"
    );
    for (const file of list) {
      addDocumentFromFile(file);
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground leading-relaxed">
        PDFs are sent to this app’s server route to extract real text with{" "}
        <code className="rounded bg-muted px-1 py-px text-xs">pdfjs-dist</code>{" "}
        (text-only extraction).
        Each document card shows a visible{" "}
        <span className="font-medium text-foreground">Extracted text preview</span>{" "}
        as soon as parsing succeeds, so you can confirm the right PDF before the
        OpenAI summary step, then an OpenAI quiz step from the same extract (with a
        rule-based fallback if the quiz API fails). Data stays in your browser via
        localStorage after processing.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        multiple
        onChange={(e) => {
          const fl = e.target.files;
          if (fl?.length) addPdfFiles(fl);
          e.target.value = "";
        }}
      />

      <Card
        className={cn(
          "relative overflow-hidden border-border/80 transition-colors",
          dragActive && "border-primary/50 bg-accent/30"
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) addPdfFiles(e.dataTransfer.files);
        }}
      >
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <FileUp className="size-4 text-primary" />
            Upload
          </CardTitle>
          <CardDescription>
            Drag and drop or browse. Each new file is appended to your library.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground"
          >
            <UploadCloud className="mb-2 size-8 opacity-50" />
            <p>Drop one or more PDFs here</p>
            <p className="mt-1 text-xs">Each file is appended — nothing is overwritten</p>
            {anyBusy ? (
              <p className="mt-2 text-[11px] text-amber-800/90 dark:text-amber-200/90">
                Some files are still processing; you can keep adding more.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Your documents</h2>
            {documents.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Default: newest upload first. Rename or remove files to keep the
                workspace tidy.
              </p>
            ) : null}
          </div>
          {documents.length > 0 ? (
            <DocumentSortToolbar
              value={docSort}
              onChange={setDocSort}
              totalCount={documents.length}
            />
          ) : null}
        </div>
        {documents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={UploadCloud}
              title="No documents in this subject yet"
              description="Upload a PDF. We’ll extract text, then build a summary and questions from that extract."
            />
          </div>
        ) : (
          <ScrollArea className="mt-4 h-[min(70vh,52rem)] pr-3">
            <ul className="space-y-3 pb-4">
            {sortedDocuments.map((d) => (
              <li key={d.id}>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 gap-3">
                    <div className="min-w-0 flex-1">
                      {renamingId === d.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={renameInputRef}
                            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                renameDocument(d.id, renameDraft);
                                setRenamingId(null);
                              }
                              if (e.key === "Escape") {
                                setRenamingId(null);
                              }
                            }}
                            aria-label="Document name"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="shrink-0 gap-1"
                            onClick={() => {
                              renameDocument(d.id, renameDraft);
                              setRenamingId(null);
                            }}
                          >
                            <Check className="size-3.5" />
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="shrink-0"
                            onClick={() => setRenamingId(null)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <CardTitle className="min-w-0 flex-1 truncate font-heading text-base">
                            {d.fileName}
                          </CardTitle>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                            title="Rename"
                            onClick={() => {
                              setRenamingId(d.id);
                              setRenameDraft(d.fileName);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      )}
                      <CardDescription className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                        <span>
                          Uploaded{" "}
                          {formatIsoDateLongEn(d.uploadedAt.slice(0, 10))}
                        </span>
                        {d.summary ? (
                          <span className="text-primary/90">· Summary</span>
                        ) : d.status === "ready" ? (
                          <span>· No summary</span>
                        ) : null}
                        {d.quiz ? (
                          <span className="text-primary/90">· Quiz</span>
                        ) : null}
                        {(mistakeCountByDoc.get(d.id) ?? 0) > 0 ? (
                          <span>
                            · {mistakeCountByDoc.get(d.id)} mistake
                            {(mistakeCountByDoc.get(d.id) ?? 0) === 1
                              ? ""
                              : "s"}
                          </span>
                        ) : null}
                        {d.pageCount != null ? (
                          <span>· {d.pageCount} pages</span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <DocumentAnalysisBadge doc={d} />
                      {d.textTruncated ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          Text truncated
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <ParseSuccessBanner d={d} />
                  <details
                    className="group"
                    open={documents.length <= 4}
                  >
                    <summary className="cursor-pointer border-t border-border/50 bg-muted/15 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Extract &amp; technical details
                    </summary>
                    <ExtractedTextPreviewSection d={d} />
                    <ParseDebugPanel d={d} />
                  </details>
                  {d.status === "ready" && d.errorMessage ? (
                    <div className="border-t border-amber-300/80 bg-amber-50/70 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/25">
                      <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                        Analysis interrupted (text was saved)
                      </p>
                      <p className="mt-1 text-xs text-amber-900/95 dark:text-amber-200/95 leading-relaxed">
                        {d.errorMessage}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Use <strong>Retry analysis</strong> to call OpenAI again
                        without re-uploading.
                      </p>
                    </div>
                  ) : null}
                  {d.status === "ready" && d.extractTooShort && d.summaryError ? (
                    <div className="border-t border-amber-300/80 bg-amber-50/80 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                      <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                      Extract too short for reliable AI summary
                      </p>
                      <p className="mt-1 text-xs text-amber-900/95 dark:text-amber-200/95 leading-relaxed">
                        {d.summaryError}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        This usually means the PDF is image-based (scanned), uses
                        fonts that did not extract, or is nearly empty—not a missing
                        API key. OCR is not enabled in this app.
                      </p>
                    </div>
                  ) : null}
                  {d.status === "ready" && d.summaryError && !d.extractTooShort ? (
                    <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3">
                      <p className="text-sm font-medium text-destructive">
                        Parsing succeeded · summary generation failed
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        The PDF text above is fine. Only the OpenAI summary step
                        failed.
                      </p>
                      <p className="mt-2 text-xs text-destructive/90 leading-relaxed">
                        {d.summaryError}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        Check{" "}
                        <code className="rounded bg-muted px-1 py-px">OPENAI_API_KEY</code>{" "}
                        in{" "}
                        <code className="rounded bg-muted px-1 py-px">.env.local</code>
                        , model name, quotas, and network. Open{" "}
                        <span className="font-medium">Technical details</span> for
                        the exact server error string.
                      </p>
                    </div>
                  ) : null}
                  {d.status === "ready" && d.quizError ? (
                    <div className="border-t border-amber-300/80 bg-amber-50/80 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                      <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                        Parsing succeeded · quiz generation failed
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed dark:text-amber-100/80">
                        Your PDF was read correctly. OpenAI could not build the
                        quiz, so rule-based questions from the same extract are
                        shown instead—they are still usable for revision.
                      </p>
                      <p className="mt-2 text-xs text-amber-900/95 dark:text-amber-200/95 leading-relaxed">
                        {d.quizError}
                      </p>
                    </div>
                  ) : null}
                  {d.status === "ready" && d.summarySource === "openai" && d.summary ? (
                    <div className="border-t border-primary/20 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-foreground">
                      Summary: generated from uploaded PDF content (OpenAI)
                    </div>
                  ) : null}
                  {d.status === "ready" && d.quizSource === "openai" && d.quiz ? (
                    <div className="border-t border-primary/20 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-foreground">
                      Quiz: generated from uploaded PDF content (OpenAI)
                    </div>
                  ) : null}
                  <CardContent className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                    {d.status === "ready" ? (
                      <>
                        <Link
                          href={`${base}/summary`}
                          onClick={() => selectDocument(d.id)}
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "gap-1.5"
                          )}
                        >
                          <BookOpen className="size-3.5" />
                          Summary
                        </Link>
                        <Link
                          href={`${base}/quiz`}
                          onClick={() => selectDocument(d.id)}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "gap-1.5"
                          )}
                        >
                          <ListChecks className="size-3.5" />
                          Quiz
                        </Link>
                        {canRetryAnalysis(d, anyBusy) ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => retryDocumentAnalysis(d.id)}
                          >
                            <RefreshCw className="size-3.5" />
                            Retry analysis
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove “${d.fileName}” from this subject? Summaries and quiz data for this file will be deleted.`
                          )
                        ) {
                          deleteDocument(d.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
