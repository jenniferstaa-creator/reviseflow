"use client";

import * as React from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { useSubjectWorkspace } from "@/context/subject-workspace-context";
import { MOCK_MASTERED_TOPICS, MOCK_WEAK_TOPICS } from "@/data/mock-course";
import { buttonVariants } from "@/lib/button-variants";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export default function SubjectWeakAreasPage() {
  const { subjectId, mistakes, subjectAnalysis } = useSubjectWorkspace();
  const base = `/subjects/${subjectId}`;

  const ranked = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mistakes) {
      map.set(m.conceptTag, (map.get(m.conceptTag) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([concept, count], i) => ({
        concept,
        count,
        rank: i + 1,
      }));
  }, [mistakes]);

  const suggestedOrder = React.useMemo(() => {
    const fromMistakes = ranked.map((r) => r.concept);
    const fromAnalysis = subjectAnalysis?.weakestAreas ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    const push = (s: string) => {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(s.trim());
    };
    for (const c of fromMistakes) push(c);
    for (const c of fromAnalysis) push(c);
    if (out.length > 0) return out;
    return MOCK_WEAK_TOPICS;
  }, [ranked, subjectAnalysis]);

  if (mistakes.length === 0 && !subjectAnalysis?.weakestAreas.length) {
    return (
      <EmptyState
        icon={Target}
        title="No weakness signal yet"
        description="Log quiz mistakes or generate course insights on the overview (weak areas from your PDF summaries) to prioritise revision."
      >
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={`${base}`} className={cn(buttonVariants({ variant: "secondary" }))}>
            Course insights
          </Link>
          <Link href={`${base}/quiz`} className={cn(buttonVariants())}>
            Take quiz
          </Link>
        </div>
        <div className="mt-4 w-full max-w-md rounded-xl border border-border/80 bg-card p-4 text-left text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Example topics (demo only)
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
            {MOCK_WEAK_TOPICS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      </EmptyState>
    );
  }

  const maxMiss = ranked[0]?.count ?? 1;

  return (
    <div className="space-y-8">
      {subjectAnalysis?.weakestAreas.length ? (
        <SectionCard
          title="Subject-level weak signals"
          description="From course insights (all documents + mistakes model). Cross-check with your mistake list below."
        >
          <ul className="flex flex-wrap gap-2">
            {subjectAnalysis.weakestAreas.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {ranked.length > 0 ? (
        <SectionCard
          title="Most missed concepts"
          description="Ranked from mistakes logged across all PDFs in this subject."
        >
          <ul className="space-y-4">
            {ranked.map((r) => (
              <li key={r.concept} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-foreground">
                    {r.rank}. {r.concept}
                  </span>
                  <Badge variant="secondary">
                    {r.count} miss{r.count === 1 ? "" : "es"}
                  </Badge>
                </div>
                <Progress value={(r.count / maxMiss) * 100} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Suggested review order"
        description="Mistakes first, then subject-level weak areas, then any demo placeholders."
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/90">
          {suggestedOrder.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title="Topics you’re carrying well (demo)"
        description="Static hints until analytics tie to your attempts."
      >
        <ul className="flex flex-wrap gap-2">
          {MOCK_MASTERED_TOPICS.map((t) => (
            <Badge key={t} variant="outline" className="font-normal">
              {t}
            </Badge>
          ))}
        </ul>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`${base}/quiz?retry=1`}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Retry wrong questions
        </Link>
        <Link
          href={`${base}/mistakes`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Open notebook
        </Link>
      </div>
    </div>
  );
}
