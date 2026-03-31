"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  ChevronLeft,
  FileStack,
  FileUp,
  LayoutDashboard,
  ListChecks,
  Menu,
  PanelTop,
  Sparkles,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";

type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ElementType }[];
};

function buildNavSections(base: string): NavSection[] {
  return [
    {
      label: "Workspace",
      items: [
        { href: base, label: "Overview", icon: PanelTop },
        { href: `${base}/upload`, label: "Files & upload", icon: FileUp },
      ],
    },
    {
      label: "Study",
      items: [
        { href: `${base}/summary`, label: "Summary", icon: BookOpen },
        { href: `${base}/quiz`, label: "Quiz", icon: ListChecks },
      ],
    },
    {
      label: "Mistakes",
      items: [
        { href: `${base}/mistakes`, label: "Notebook", icon: ClipboardList },
        { href: `${base}/weak-areas`, label: "Weak areas", icon: Target },
      ],
    },
    {
      label: "Plan",
      items: [
        { href: `${base}/exam-planner`, label: "Exam planner", icon: CalendarDays },
        { href: `${base}/today`, label: "Today’s focus", icon: Sparkles },
        { href: `${base}/progress`, label: "Progress", icon: LayoutDashboard },
      ],
    },
  ];
}

function SubjectNavLinks({
  base,
  pathname,
  onNavigate,
}: {
  base: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const sections = buildNavSections(base);
  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      <Link
        href="/subjects"
        onClick={onNavigate}
        className="mx-2 flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        All subjects
      </Link>
      <Separator className="opacity-60" />
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== base && pathname.startsWith(href + "/")) ||
                (href === base && pathname === base);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SubjectSidebar() {
  const { subjectId, subject } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-border/80 md:bg-sidebar">
        <div className="flex h-14 flex-col justify-center gap-0.5 border-b border-border/80 px-4 py-2">
          <Link
            href="/subjects"
            className="font-heading text-sm font-semibold tracking-tight text-foreground hover:text-primary"
          >
            ReviseFlow
          </Link>
          <p className="flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
            <FileStack className="size-3 shrink-0 opacity-70" />
            <span className="truncate">{subject.name}</span>
          </p>
        </div>
        <ScrollArea className="flex-1">
          <SubjectNavLinks base={base} pathname={pathname} />
        </ScrollArea>
      </aside>

      <div className="flex items-center gap-2 border-b border-border/80 bg-sidebar px-3 py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            )}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,280px)] p-0">
            <SheetHeader className="border-b border-border/80 px-4 py-3 text-left">
              <SheetTitle className="truncate text-sm">{subject.name}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <SubjectNavLinks
                base={base}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <Separator orientation="vertical" className="h-6" />
        <span className="truncate font-medium text-sm text-foreground">
          {subject.name}
        </span>
      </div>
    </>
  );
}
