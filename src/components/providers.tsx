"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/context/workspace-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </TooltipProvider>
  );
}
