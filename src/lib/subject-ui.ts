import * as React from "react";
import type { SubjectAccent, SubjectIconId } from "@/data/types";
import {
  BookOpen,
  Brain,
  GraduationCap,
  Library,
  LineChart,
  Microscope,
  type LucideIcon,
} from "lucide-react";

export const SUBJECT_ACCENTS: { value: SubjectAccent; label: string }[] = [
  { value: "teal", label: "Teal" },
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "sky", label: "Sky" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
];

export const SUBJECT_ICONS: { value: SubjectIconId; label: string }[] = [
  { value: "book-open", label: "Course" },
  { value: "graduation-cap", label: "Degree" },
  { value: "library", label: "Library" },
  { value: "microscope", label: "Lab" },
  { value: "brain", label: "Theory" },
  { value: "line-chart", label: "Analysis" },
];

const ACCENT_RING: Record<SubjectAccent, string> = {
  teal: "ring-teal-500/25 bg-teal-500/10 text-teal-800 dark:text-teal-100",
  indigo: "ring-indigo-500/25 bg-indigo-500/10 text-indigo-800 dark:text-indigo-100",
  violet: "ring-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-100",
  sky: "ring-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-100",
  rose: "ring-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-100",
  amber: "ring-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100",
};

export function accentRingClass(accent: SubjectAccent): string {
  return ACCENT_RING[accent] ?? ACCENT_RING.teal;
}

const ACCENT_BORDER: Record<SubjectAccent, string> = {
  teal: "border-l-teal-500",
  indigo: "border-l-indigo-500",
  violet: "border-l-violet-500",
  sky: "border-l-sky-500",
  rose: "border-l-rose-500",
  amber: "border-l-amber-500",
};

export function accentBorderClass(accent: SubjectAccent): string {
  return ACCENT_BORDER[accent] ?? ACCENT_BORDER.teal;
}

const ICON_MAP: Record<SubjectIconId, LucideIcon> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  library: Library,
  microscope: Microscope,
  brain: Brain,
  "line-chart": LineChart,
};

export function SubjectIcon({
  id,
  className,
}: {
  id: SubjectIconId;
  className?: string;
}) {
  const Icon = ICON_MAP[id] ?? BookOpen;
  return React.createElement(Icon, { className });
}
