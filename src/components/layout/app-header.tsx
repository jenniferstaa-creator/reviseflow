"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function AppHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="border-b border-border/80 bg-card/80 px-4 py-3 backdrop-blur-sm md:px-8 md:py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              Demo
            </Badge>
          </div>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Link
          href="/subjects"
          className="text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          All subjects
        </Link>
      </div>
    </header>
  );
}
