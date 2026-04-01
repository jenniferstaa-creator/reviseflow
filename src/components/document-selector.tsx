"use client";

import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { cn } from "@/lib/utils";
import {
  documentStatusSortRank,
  sortStudyDocuments,
} from "@/components/document-sort-toolbar";

export function DocumentSelector({
  className,
}: {
  className?: string;
}) {
  const { documents, selectedDocumentId, selectDocument } =
    useSubjectWorkspace();

  const options = sortStudyDocuments(
    documents,
    "status",
    (d) => d.uploadedAt,
    (d) => d.fileName,
    (d) => documentStatusSortRank(d.status)
  );

  if (options.length === 0) return null;

  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        Active document (per-file summary & quiz)
      </span>
      <select
        className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selectedDocumentId ?? ""}
        onChange={(e) =>
          selectDocument(e.target.value === "" ? null : e.target.value)
        }
      >
        {options.length > 1 ? (
          <option value="">Choose a document…</option>
        ) : null}
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fileName}
            {d.status === "ready"
              ? d.quizError && d.quizSource === "heuristic"
                ? " (quiz: fallback)"
                : d.summaryError
                  ? " (summary: failed)"
                  : ""
              : d.status === "error"
                ? d.parseSucceeded
                  ? " (parse OK · error)"
                  : " (failed)"
                : d.status === "uploading" || d.status === "analyzing"
                  ? " (processing)"
                  : ` (${d.status})`}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Subject-wide course insights and the exam planner use every ready PDF together—they are not tied to this picker.
      </p>
    </label>
  );
}
