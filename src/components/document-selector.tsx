"use client";

import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { cn } from "@/lib/utils";

export function DocumentSelector({
  className,
}: {
  className?: string;
}) {
  const { documents, selectedDocumentId, selectDocument } =
    useSubjectWorkspace();
  const ready = documents.filter((d) => d.status === "ready");
  const selected = documents.find((d) => d.id === selectedDocumentId);
  const pendingSelected =
    selected &&
    selected.status !== "ready" &&
    !ready.some((r) => r.id === selected.id)
      ? [selected]
      : [];
  const options = [...pendingSelected, ...ready];

  if (options.length === 0) return null;

  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        Active document
      </span>
      <select
        className="w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selectedDocumentId ?? ""}
        onChange={(e) =>
          selectDocument(e.target.value === "" ? null : e.target.value)
        }
      >
        {ready.length > 1 || pendingSelected.length > 0 ? (
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
                : " (processing)"}
          </option>
        ))}
      </select>
    </label>
  );
}
