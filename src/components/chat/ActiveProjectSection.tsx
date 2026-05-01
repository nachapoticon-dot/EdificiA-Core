"use client";

import { Building2, X } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";

export function ActiveProjectSection() {
  const { activeProject, clearActiveProject } = useProjectContext();

  if (!activeProject) return null;

  return (
    <div className="px-2 pb-2">
      {/* Section label */}
      <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
        Proyecto activo
      </p>
      {/* Active project chip — terracotta left border, accent bg */}
      <div className="group flex items-center gap-2 rounded-[6px] border-l-2 border-l-primary bg-primary/[0.06] px-2.5 py-2">
        <Building2 className="h-3 w-3 shrink-0 text-primary" />
        <span className="flex-1 truncate text-[12px] font-medium text-foreground">
          {activeProject.name}
        </span>
        <button
          onClick={clearActiveProject}
          title="Cambiar proyecto"
          className="hidden shrink-0 text-muted-foreground/40 transition-colors hover:text-muted-foreground group-hover:flex"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
