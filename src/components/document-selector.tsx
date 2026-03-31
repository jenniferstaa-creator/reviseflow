"use client";

import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { cn } from "@/lib/utils";

export function DocumentSelector({
  className,
}: {
  className?: string;
}) {
  const { documents, selectedDocumentId, selectDocument } = useSubjectWorkspace();
  const ready = documents.filter((d) => d.status === "ready");

  if (ready.length === 0) return null;

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
        {ready.length > 1 ? <option value="">Choose a document…</option> : null}
        {ready.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fileName}
          </option>
        ))}
      </select>
    </label>
  );
}
