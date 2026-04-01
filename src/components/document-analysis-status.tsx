"use client";

import type { StudyDocument } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AnalysisStatusTone =
  | "processing"
  | "ready"
  | "ready_warn"
  | "error"
  | "idle";

export function getDocumentAnalysisTone(d: StudyDocument): AnalysisStatusTone {
  if (d.status === "uploading" || d.status === "analyzing") return "processing";
  if (d.status === "error") return "error";
  if (d.status === "idle") return "idle";
  if (d.status === "ready") {
    if (
      d.summaryError ||
      d.quizError ||
      d.errorMessage ||
      d.extractTooShort
    ) {
      return "ready_warn";
    }
    return "ready";
  }
  return "idle";
}

/** Short, scannable label for course file lists. */
export function documentAnalysisStatusLabel(d: StudyDocument): string {
  const tone = getDocumentAnalysisTone(d);
  if (tone === "processing") {
    return d.analysisStep?.slice(0, 48) || "Processing…";
  }
  if (tone === "error") {
    if (d.pipelineFailureStage === "pdf_parse") return "PDF parse failed";
    if (d.pipelineFailureStage === "empty_extract") return "No text extracted";
    if (d.pipelineFailureStage === "unexpected") return "Processing error";
    return "Failed";
  }
  if (tone === "ready_warn") {
    if (d.extractTooShort) return "Ready · low text";
    if (d.summaryError && d.quizError) return "Ready · AI gaps";
    if (d.summaryError) return "Ready · summary issue";
    if (d.quizError) return "Ready · quiz fallback";
    return "Ready · check details";
  }
  if (tone === "ready") return "Ready";
  return "Queued";
}

export function DocumentAnalysisBadge({
  doc,
  className,
}: {
  doc: StudyDocument;
  className?: string;
}) {
  const tone = getDocumentAnalysisTone(doc);
  const label = documentAnalysisStatusLabel(doc);
  const variant =
    tone === "error"
      ? "destructive"
      : tone === "processing" || tone === "idle"
        ? "secondary"
        : tone === "ready_warn"
          ? "outline"
          : "default";

  return (
    <Badge
      variant={variant}
      className={cn(
        "max-w-[14rem] truncate text-[10px] font-medium",
        tone === "ready" && "bg-emerald-600/90 hover:bg-emerald-600 dark:bg-emerald-700",
        className
      )}
      title={label}
    >
      {label}
    </Badge>
  );
}
