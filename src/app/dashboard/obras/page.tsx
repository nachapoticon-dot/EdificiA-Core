"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, LayoutGrid } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectCard } from "@/components/obras/ProjectCard";

export default function ObrasPage() {
  const { projects, createProject, isLoading, isCreating } = useProjectContext();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");

  function handleCreate() {
    if (!newName.trim()) return;
    createProject(newName.trim());
    setNewName("");
    setShowForm(false);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="font-display text-[22px] font-medium leading-tight tracking-[-0.02em] text-foreground">
                  Mis Obras
                </h1>
                {!isLoading && projects.length > 0 && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {projects.length} proyecto{projects.length !== 1 ? "s" : ""} activos
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nueva obra
            </button>
          </div>

          {/* Inline create form */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 overflow-hidden"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setShowForm(false); setNewName(""); }
                    }}
                    placeholder="Nombre de la obra o proyecto…"
                    className="w-full rounded-[10px] border border-border bg-background py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || isCreating}
                  className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity disabled:opacity-40 hover:opacity-90"
                >
                  {isCreating
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    : <Plus className="h-4 w-4" />
                  }
                  {isCreating ? "Creando…" : "Crear"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewName(""); }}
                  className="rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl px-8 py-8">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-[14px] border border-border bg-card" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[16px] border border-border bg-card text-muted-foreground">
              <Building2 className="h-7 w-7" strokeWidth={1.25} />
            </div>
            <h2 className="font-display text-[20px] font-medium text-foreground">
              Sin obras todavía
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Creá tu primer proyecto para empezar a organizar documentos y auditar presupuestos.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Crear primera obra
            </button>
          </motion.div>
        )}

        {/* Project grid */}
        {!isLoading && projects.length > 0 && (
          <>
            {/* Decorative eyebrow */}
            <div className="mb-6 flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
                Proyectos activos
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
