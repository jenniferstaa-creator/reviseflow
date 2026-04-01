"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";

const SEGMENT_META: Record<
  string,
  { title: string; description?: string }
> = {
  "": {
    title: "Overview",
    description: "Study workspace for this subject—files, progress, and quick links.",
  },
  upload: {
    title: "Files & upload",
    description: "Add PDFs and open summaries or quizzes per document.",
  },
  summary: {
    title: "Summary",
    description: "Structured takeaways from the selected document.",
  },
  quiz: {
    title: "Quiz",
    description: "Check understanding with mixed question types.",
  },
  "mock-practice": {
    title: "Written practice",
    description:
      "AI questions from your PDFs or past papers—answer first, then reveal models and coaching.",
  },
  mistakes: {
    title: "Mistake notebook",
    description: "Wrong answers for this subject, with context.",
  },
  "weak-areas": {
    title: "Weak areas",
    description: "Most important to review now, ranked by misses.",
  },
  "exam-planner": {
    title: "Exam planner",
    description: "Turn your exam date into a daily schedule.",
  },
  today: {
    title: "Today’s focus",
    description: "What matters for this study session.",
  },
  progress: {
    title: "Progress",
    description: "Signal on plans and materials—not slogans.",
  },
};

export function SubjectHeaderDynamic() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // /subjects/:id/(rest)
  const rest = segments.slice(2).join("/");
  const first = rest.split("/")[0] ?? "";
  const m = SEGMENT_META[first] ?? SEGMENT_META[""];

  return <AppHeader title={m.title} description={m.description} />;
}
