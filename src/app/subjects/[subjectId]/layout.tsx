"use client";

import { SubjectWorkspaceBoundary } from "@/context/subject-workspace-context";
import { SubjectSidebar } from "@/components/layout/subject-sidebar";
import { SubjectHeaderDynamic } from "@/components/layout/subject-header-dynamic";

export default function SubjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubjectWorkspaceBoundary>
      <div className="flex min-h-[calc(100vh-3.5rem)] bg-background">
        <SubjectSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <SubjectHeaderDynamic />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </SubjectWorkspaceBoundary>
  );
}
