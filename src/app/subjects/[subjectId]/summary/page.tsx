"use client";

import Link from "next/link";
import { BookMarked, ListTree } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { buttonVariants } from "@/lib/button-variants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { DocumentSelector } from "@/components/document-selector";
import { cn } from "@/lib/utils";

export default function SubjectSummaryPage() {
  const { subjectId, selectedDocument, documents } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;
  const summary = selectedDocument?.summary ?? null;
  const ready = documents.some((d) => d.status === "ready");

  if (!ready) {
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

  if (!selectedDocument || !summary) {
    return (
      <div className="space-y-4">
        <DocumentSelector />
        <EmptyState
          icon={BookMarked}
          title="Pick a document"
          description="Choose which uploaded PDF to view summary for using the selector above."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DocumentSelector />
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
      </Tabs>
    </div>
  );
}
