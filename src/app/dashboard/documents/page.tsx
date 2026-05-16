"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, FileText, FileCode2, FileType2, Image,
  Database, Trash2, RefreshCw, FolderOpen, Layers, Filter, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectContext } from "@/contexts/ProjectContext";
import { getAuthHeaders } from "@/lib/insforge/client";

import type { DocumentFile } from "@/types";

const TYPE_ICONS: Record<string, React.ElementType> = {
  excel: FileSpreadsheet,
  pdf: FileText,
  dxf: FileCode2,
  docx: FileType2,
  image: Image,
  other: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  excel: "Excel",
  pdf: "PDF",
  dxf: "Plano DXF",
  docx: "Word",
  image: "Imagen",
  other: "Otro",
};

const TYPE_COLOR: Record<string, string> = {
  excel: "text-green-600 bg-green-50 dark:bg-green-950/30",
  pdf: "text-red-600 bg-red-50 dark:bg-red-950/30",
  dxf: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  docx: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  image: "text-orange-600 bg-orange-50 dark:bg-orange-950/30",
  other: "text-muted-foreground bg-muted",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}


export default function DocumentsPage() {
  const { activeProject } = useProjectContext();
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterByProject, setFilterByProject] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/documents", { headers });
      const data = await res.json() as { files?: DocumentFile[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al cargar documentos.");
      } else {
        setFiles(data.files ?? []);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  const visibleFiles = filterByProject && activeProject
    ? files.filter((f) => f.project_id === activeProject.id)
    : files;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFiles(); }, [loadFiles]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Error al eliminar el archivo.");
      }
    } catch {
      setError("Error al eliminar el archivo.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalChunks = visibleFiles.reduce((s, f) => s + f.chunkCount, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-6 py-3.5">
        <Database className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Base Documental</h1>
        <div className="ml-auto flex items-center gap-3">
          {visibleFiles.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {visibleFiles.length} archivo{visibleFiles.length !== 1 ? "s" : ""} · {totalChunks} fragmentos indexados
            </span>
          )}
          {activeProject && (
            <Button
              variant={filterByProject ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={() => setFilterByProject((v) => !v)}
              title={filterByProject ? "Mostrar todos" : `Filtrar por "${activeProject.name}"`}
            >
              <Filter className="h-3.5 w-3.5" />
              {filterByProject ? activeProject.name : "Filtrar obra"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={() => { void loadFiles(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Cargando documentos…
          </div>
        ) : files.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {visibleFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  deleting={deletingId === file.id}
                  onDelete={() => { void handleDelete(file.id); }}
                  projectName={activeProject && file.project_id === activeProject.id ? activeProject.name : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({
  file,
  deleting,
  onDelete,
  projectName,
}: {
  file: DocumentFile;
  deleting: boolean;
  onDelete: () => void;
  projectName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = TYPE_ICONS[file.file_type] ?? FileText;
  const colorClass = TYPE_COLOR[file.file_type] ?? TYPE_COLOR.other;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/30"
    >
      {/* Type badge */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.file_name}</p>
        <div className="flex items-center gap-2.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {TYPE_LABELS[file.file_type] ?? "Otro"}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">{formatSize(file.file_size_bytes)}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[11px] text-muted-foreground">{formatDate(file.created_at)}</span>
        </div>
      </div>

      {/* Project badge */}
      {projectName && !confirming && (
        <div className="hidden sm:flex items-center gap-1 rounded-full border border-primary/20 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-medium text-primary">
          {projectName}
        </div>
      )}

      {/* Chunk badge */}
      {file.chunkCount > 0 && !confirming && (
        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <Layers className="h-3 w-3" />
          {file.chunkCount} fragmentos
        </div>
      )}

      {/* Delete / Confirm */}
      {confirming ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-destructive font-medium">
            <AlertTriangle className="h-3 w-3" />
            ¿Eliminar?
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => { setConfirming(false); onDelete(); }}
            disabled={deleting}
          >
            {deleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Confirmar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
          onClick={() => setConfirming(true)}
          disabled={deleting}
          title="Eliminar archivo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FolderOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No hay documentos indexados</p>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          Subí un archivo desde el Asistente de Obra (Excel, PDF, DXF, DOCX) para que quede en tu base documental.
        </p>
      </div>
    </motion.div>
  );
}
