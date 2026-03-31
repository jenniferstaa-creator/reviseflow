"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
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
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { formatIsoDateLongEn } from "@/lib/dates";

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
        PDFs you add here stay in this subject. Processing is simulated in the
        demo—files are not uploaded to a server.{" "}
        {/* TODO(PDF): multi-part upload + job queue */}
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
            <p className="mt-1 text-xs">PDF only in this demo</p>
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
              description="Upload a lecture PDF or export. When analysis finishes, open summary and quiz from each card."
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
                        {d.status === "ready" ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary">
                            <CheckCircle2 className="size-3.5" />
                            Ready
                          </span>
                        ) : d.status === "uploading" ||
                          d.status === "analyzing" ? (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Loader2 className="size-3.5 animate-spin text-primary" />
                            {d.analysisStep ?? "Working…"}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        d.status === "ready" ? "default" : "secondary"
                      }
                      className="shrink-0 capitalize"
                    >
                      {d.status}
                    </Badge>
                  </CardHeader>
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
