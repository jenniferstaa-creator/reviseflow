"use client";

import Link from "next/link";
import { BookMarked, ListTree, Loader2 } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { buttonVariants } from "@/lib/button-variants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentSelector } from "@/components/document-selector";
import { cn } from "@/lib/utils";

export default function SubjectSummaryPage() {
  const { subjectId, selectedDocument, documents } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;
  const summary = selectedDocument?.summary ?? null;

  const readyDocs = documents.filter((d) => d.status === "ready");
  const hasAnalyzing = documents.some(
    (d) => d.status === "uploading" || d.status === "analyzing"
  );

  if (readyDocs.length === 0) {
    if (hasAnalyzing) {
      return (
        <EmptyState
          icon={BookMarked}
          title="Generating your summary…"
          description="Text extraction and the OpenAI summary step can take up to a minute. You can keep this tab open or check Files & upload for progress."
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
        icon={BookMarked}
        title="No analyzed documents yet"
        description="Upload a PDF and wait for analysis to finish. Summaries are stored per document in this subject."
      >
        <Link href={`${base}/upload`} className={cn(buttonVariants())}>
          Go to files & upload
        </Link>
      </EmptyState>
    );
  }

  if (!selectedDocument) {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <EmptyState
          icon={BookMarked}
          title="Pick a document"
          description="Choose which uploaded PDF to view using the selector above."
        />
      </div>
    );
  }

  if (selectedDocument.status === "analyzing") {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/80 bg-muted/20 px-6 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            Generating AI summary for “{selectedDocument.fileName}”…
          </p>
          <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
            {selectedDocument.analysisStep ?? "Working…"}
          </p>
        </div>
      </div>
    );
  }

  if (selectedDocument.summaryError && !summary) {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <EmptyState
          icon={BookMarked}
          title="Summary could not be generated"
          description={selectedDocument.summaryError}
        >
          <Link href={`${base}/upload`} className={cn(buttonVariants())}>
            Back to files & upload
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <EmptyState
          icon={BookMarked}
          title="No summary for this document"
          description="Choose another ready document or upload again."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DocumentSelector />

      {selectedDocument.summarySource === "openai" ? (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-foreground">
          Generated from uploaded PDF content
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {selectedDocument.fileName}
          </p>
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {summary.courseTitle}
          </h2>
        </div>
        <Link href={`${base}/quiz`} className={cn(buttonVariants(), "w-fit")}>
          Practice quiz
        </Link>
      </div>

      <SectionCard title="Chapter overview" description="High-level narrative of the module">
        <p className="text-sm leading-relaxed text-foreground/90">
          {summary.chapterOverview}
        </p>
      </SectionCard>

      <Tabs defaultValue="concepts">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="concepts">Key concepts</TabsTrigger>
          <TabsTrigger value="exam">Exam topics</TabsTrigger>
          <TabsTrigger value="confusing">Confusing points</TabsTrigger>
          <TabsTrigger value="simple">Simplified</TabsTrigger>
          <TabsTrigger value="source">Extracted text</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts" className="mt-4">
          <ul className="space-y-3">
            {summary.keyConcepts.map((c, i) => (
              <li
                key={`concept-${i}`}
                className="flex gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 text-sm leading-relaxed shadow-sm"
              >
                <ListTree className="mt-0.5 size-4 shrink-0 text-primary" />
                {c}
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="exam" className="mt-4">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            {summary.likelyExamTopics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </TabsContent>
        <TabsContent value="confusing" className="mt-4">
          <div className="space-y-3">
            {summary.confusingPoints.map((x) => (
              <div
                key={x.title}
                className="rounded-lg border border-amber-200/90 bg-amber-50/70 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">{x.title}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {x.note}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="simple" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {summary.simplifiedExplanations.map((x) => (
              <div
                key={x.term}
                className="rounded-xl border border-border/80 bg-muted/30 p-4"
              >
                <Badge variant="outline" className="mb-2 font-normal">
                  {x.term}
                </Badge>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {x.explanation}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="source" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Summary and quiz for this file are derived from the text below (when{" "}
            <code className="rounded bg-muted px-1 py-0.5">parseSucceeded</code>{" "}
            is true). Open Files &amp; upload for full debugging details.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt className="font-medium text-foreground">Parsing</dt>
            <dd>
              {selectedDocument.parseSucceeded ? (
                <span className="text-primary">Succeeded</span>
              ) : (
                <span>Not available or legacy</span>
              )}
            </dd>
            <dt className="font-medium text-foreground">Summary</dt>
            <dd className="capitalize">
              {selectedDocument.summarySource ?? "—"}
            </dd>
            <dt className="font-medium text-foreground">Pages</dt>
            <dd>{selectedDocument.pageCount ?? "—"}</dd>
            <dt className="font-medium text-foreground">Chars stored</dt>
            <dd>
              {selectedDocument.extractedText.length.toLocaleString()}
              {selectedDocument.textTruncated ? " (truncated)" : ""}
            </dd>
            <dt className="font-medium text-foreground">Content source</dt>
            <dd className="capitalize">
              {selectedDocument.contentSource ?? "extracted"}
            </dd>
          </dl>
          <ScrollArea className="h-[min(360px,50vh)] rounded-xl border border-border/80 bg-muted/20">
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground/90">
              {selectedDocument.extractedText ||
                selectedDocument.textPreview ||
                "No extracted text stored for this document."}
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
