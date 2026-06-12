"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, LayoutGrid } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ProjectCard } from "./_components/ProjectCard";

export default function ObrasPage() {
  const { projects, createProject, isLoading, isCreating } = useProjectContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim() || isCreating) return;
    setCreateError(null);
    try {
      await createProject(newName.trim());
      setNewName("");
      setDialogOpen(false);
    } catch {
      setCreateError("No se pudo crear la obra. Verificá tu conexión e intentá de nuevo.");
    }
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setNewName("");
      setCreateError(null);
    }
  }

  const createDialog = (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="h-9 gap-2 rounded-[8px] text-[13px] font-semibold">
            <Plus className="h-4 w-4" />
            Nueva obra
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-medium">Nueva obra</DialogTitle>
          <DialogDescription>
            Creá el proyecto para empezar a organizar documentos, expedientes y seguimiento de obra.
          </DialogDescription>
        </DialogHeader>

        {createError && (
          <Alert variant="destructive" className="rounded-[8px]">
            <AlertDescription className="text-xs">{createError}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="obra-name" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Nombre de la obra
          </FieldLabel>
          <Input
            id="obra-name"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="Nombre de la obra o proyecto…"
            className="h-10 rounded-[8px]"
          />
        </Field>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-[8px]"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || isCreating}
            className="gap-2 rounded-[8px]"
          >
            {isCreating ? <Spinner /> : <Plus className="h-4 w-4" />}
            {isCreating ? "Creando…" : "Crear obra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card/92 px-4 py-5 backdrop-blur md:px-8 md:py-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
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

            {createDialog}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-[14px] border border-border" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Empty className="rounded-[10px] border border-dashed border-border bg-card/70 py-20">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="h-16 w-16 rounded-[16px] border border-border bg-card text-muted-foreground">
                  <Building2 className="h-7 w-7" strokeWidth={1.25} />
                </EmptyMedia>
                <EmptyTitle className="font-display text-[20px] font-medium text-foreground">
                  Sin obras todavía
                </EmptyTitle>
                <EmptyDescription className="max-w-xs text-sm leading-relaxed">
                  Creá tu primer proyecto para empezar a organizar documentos y auditar presupuestos.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="gap-2 rounded-[10px] px-5 text-[13px] font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Crear primera obra
                </Button>
              </EmptyContent>
            </Empty>
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
