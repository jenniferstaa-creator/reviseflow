"use client";

export type DocumentSortKey =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "status";

const LABELS: Record<DocumentSortKey, string> = {
  "date-desc": "Upload date · newest",
  "date-asc": "Upload date · oldest",
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  status: "Status (attention first)",
};

export function DocumentSortToolbar({
  value,
  onChange,
  totalCount,
}: {
  value: DocumentSortKey;
  onChange: (k: DocumentSortKey) => void;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {totalCount} document{totalCount === 1 ? "" : "s"} in this subject
      </p>
      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="shrink-0">Sort</span>
        <select
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(e) => onChange(e.target.value as DocumentSortKey)}
        >
          {(Object.keys(LABELS) as DocumentSortKey[]).map((k) => (
            <option key={k} value={k}>
              {LABELS[k]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function sortStudyDocuments<T>(
  docs: T[],
  sort: DocumentSortKey,
  getUploadedAt: (d: T) => string,
  getFileName: (d: T) => string,
  getStatusRank: (d: T) => number
): T[] {
  const copy = [...docs];
  copy.sort((a, b) => {
    if (sort === "date-desc") {
      return (
        new Date(getUploadedAt(b)).getTime() -
        new Date(getUploadedAt(a)).getTime()
      );
    }
    if (sort === "date-asc") {
      return (
        new Date(getUploadedAt(a)).getTime() -
        new Date(getUploadedAt(b)).getTime()
      );
    }
    if (sort === "name-asc") {
      return getFileName(a).localeCompare(getFileName(b), undefined, {
        sensitivity: "base",
      });
    }
    if (sort === "name-desc") {
      return getFileName(b).localeCompare(getFileName(a), undefined, {
        sensitivity: "base",
      });
    }
    const ra = getStatusRank(a);
    const rb = getStatusRank(b);
    if (ra !== rb) return ra - rb;
    return (
      new Date(getUploadedAt(b)).getTime() -
      new Date(getUploadedAt(a)).getTime()
    );
  });
  return copy;
}

/** Lower = more "needs attention" for status sort. */
export function documentStatusSortRank(status: string): number {
  switch (status) {
    case "error":
      return 0;
    case "analyzing":
    case "uploading":
      return 1;
    case "idle":
      return 2;
    case "ready":
      return 3;
    default:
      return 4;
  }
}
