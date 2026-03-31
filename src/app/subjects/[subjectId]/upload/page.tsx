"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  Trash2,
  UploadCloud,
  FileUp,
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

/** Shown as soon as the server returns text — before summary/quiz are ready. */
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
        ) : d.status === "ready" ? (
          <Badge variant="default" className="text-[10px] font-normal">
            Verified extract
          </Badge>
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

/** Optional: extra parsing metadata (collapsed by default). */
function ParseDebugPanel({ d }: { d: StudyDocument }) {
  const legacy = d.contentSource === "legacy-mock";
  const showDetails =
    legacy ||
    d.status === "error" ||
    (d.parseSucceeded &&
      (d.textPreview.length > 0 || d.extractedText.length > 0));

  if (!showDetails && d.status !== "ready") return null;

  return (
    <details className="rounded-b-lg border-t border-border/50 bg-muted/10 text-sm">
      <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground select-none hover:text-foreground">
        Technical details (parsing metadata)
      </summary>
      <div className="space-y-2 border-t border-border/40 px-4 py-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <dt className="font-medium text-foreground">Parsing</dt>
          <dd>
            {d.status === "error" ? (
              <span className="text-destructive">Failed</span>
            ) : d.parseSucceeded ? (
              <span className="text-primary">Succeeded</span>
            ) : legacy ? (
              <span>Not stored (legacy materials)</span>
            ) : (
              <span>Pending or unavailable</span>
            )}
          </dd>
          <dt className="font-medium text-foreground">Pages</dt>
          <dd>{d.pageCount != null ? d.pageCount : "—"}</dd>
          <dt className="font-medium text-foreground">Characters</dt>
          <dd>
            {d.extractedText.length > 0
              ? `${d.extractedText.length.toLocaleString()}${d.textTruncated ? " (truncated for storage)" : ""}`
              : "—"}
          </dd>
          <dt className="font-medium text-foreground">Source</dt>
          <dd className="capitalize">{d.contentSource ?? "extracted"}</dd>
        </dl>
        {d.parseErrorMessage || d.errorMessage ? (
          <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {d.parseErrorMessage ?? d.errorMessage}
          </p>
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
    documents,
    addDocumentFromFile,
    deleteDocument,
    selectDocument,
  } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const anyBusy = documents.some(
    (d) => d.status === "uploading" || d.status === "analyzing"
  );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") return;
    addDocumentFromFile(file);
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground leading-relaxed">
        PDFs are sent to this app’s server route to extract real text with{" "}
        <code className="rounded bg-muted px-1 py-px text-xs">pdf-parse</code>.
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
        onChange={(e) => onFile(e.target.files?.[0])}
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
          onFile(e.dataTransfer.files?.[0]);
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
            className={cn(
              "flex min-h-[120px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground",
              anyBusy && "pointer-events-none opacity-60"
            )}
          >
            <UploadCloud className="mb-2 size-8 opacity-50" />
            <p>Drop PDFs here</p>
            <p className="mt-1 text-xs">PDF only</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={anyBusy}
            onClick={() => inputRef.current?.click()}
          >
            Browse files
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-heading text-base font-semibold">Your documents</h2>
        {documents.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={UploadCloud}
              title="No documents in this subject yet"
              description="Upload a PDF. We’ll extract text, then build a summary and questions from that extract."
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {documents.map((d) => (
              <li key={d.id}>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate font-heading text-base">
                        {d.fileName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Added{" "}
                        {formatIsoDateLongEn(d.uploadedAt.slice(0, 10))}
                        {d.pageCount != null ? (
                          <span className="ml-2">· {d.pageCount} pages</span>
                        ) : null}
                        {d.status === "ready" && d.parseSucceeded ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 className="size-3.5" />
                            Parsed &amp; ready
                          </span>
                        ) : d.status === "uploading" ||
                          d.status === "analyzing" ? (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                            {d.analysisStep ?? "Working…"}
                          </span>
                        ) : d.status === "error" ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                            <AlertTriangle className="size-3.5" />
                            Parse or analysis failed
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={
                          d.status === "ready"
                            ? "default"
                            : d.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {d.status}
                      </Badge>
                      {d.textTruncated ? (
                        <Badge variant="outline" className="text-[10px]">
                          Text truncated
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <ExtractedTextPreviewSection d={d} />
                  <ParseDebugPanel d={d} />
                  {d.status === "ready" && d.summaryError ? (
                    <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3">
                      <p className="text-sm font-medium text-destructive">
                        AI summary failed
                      </p>
                      <p className="mt-1 text-xs text-destructive/90 leading-relaxed">
                        {d.summaryError}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        Check{" "}
                        <code className="rounded bg-muted px-1 py-px">OPENAI_API_KEY</code>{" "}
                        in{" "}
                        <code className="rounded bg-muted px-1 py-px">.env.local</code>
                        , quotas, and network. The quiz step still runs separately
                        (OpenAI or rule-based fallback from your PDF).
                      </p>
                    </div>
                  ) : null}
                  {d.status === "ready" && d.quizError ? (
                    <div className="border-t border-amber-300/80 bg-amber-50/80 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                      <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                        Quiz used rule-based fallback
                      </p>
                      <p className="mt-1 text-xs text-amber-900/95 dark:text-amber-200/95 leading-relaxed">
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
        )}
      </div>
    </div>
  );
}
