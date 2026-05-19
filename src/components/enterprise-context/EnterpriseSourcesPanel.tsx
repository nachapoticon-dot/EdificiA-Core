"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, FileText, FileCode2, FileType2, Image,
  Database, Trash2, RefreshCw, FolderOpen, Layers, Filter, AlertTriangle,
  AlertOctagon, AlertCircle, UploadCloud, Table2, PlugZap, Server,
  ShieldCheck, CheckCircle2, Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectContext } from "@/contexts/ProjectContext";
import { getAuthHeaders } from "@/lib/insforge/client";
import { apiErrorResponseSchema, documentReindexResponseSchema, documentsResponseSchema, uploadResponseSchema } from "@/lib/validators/api-responses";

import type { DocumentFile } from "@/types";

const ACCEPTED_UPLOAD_EXTENSIONS = ".xlsx,.xls,.csv,.pdf,.dxf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp";

const TYPE_ICONS: Record<string, React.ElementType> = {
  excel: FileSpreadsheet,
  pdf: FileText,
  dxf: FileCode2,
  docx: FileType2,
  image: Image,
  other: FileText,
};

const SOURCE_CHANNELS = [
  {
    label: "Archivos de obra",
    meta: "PDF, Excel, DXF, Word, imagen",
    description: "Carga directa para legajos, presupuestos, planos, remitos y contratos.",
    status: "Disponible",
    icon: UploadCloud,
    enabled: true,
    accent: "border-primary/30 bg-primary/[0.04]",
  },
  {
    label: "Exports de sistemas",
    meta: "CSV/XLSX de ERP, compras, contabilidad",
    description: "El mismo ingreso acepta tablas exportadas; EdificIA las clasifica antes de usarlas.",
    status: "Disponible",
    icon: Table2,
    enabled: true,
    accent: "border-emerald-500/30 bg-emerald-500/[0.06]",
  },
  {
    label: "Carpetas corporativas",
    meta: "Drive, SharePoint, OneDrive",
    description: "Conector read-only con selección explícita de carpetas autorizadas.",
    status: "Etapa 2",
    icon: PlugZap,
    enabled: false,
    accent: "border-border bg-card",
  },
  {
    label: "SQL read-only",
    meta: "Vistas, snapshots, dumps parciales",
    description: "Conexión restringida para leer tablas operativas sin tocar sistemas origen.",
    status: "Etapa 2",
    icon: Server,
    enabled: false,
    accent: "border-border bg-card",
  },
] as const;

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

const INDEXING_BADGE: Record<NonNullable<DocumentFile["indexing_status"]>, {
  label: string;
  classes: string;
  icon: React.ElementType;
  tooltip: string;
} | null> = {
  // No badge para los estados sanos — el chip "fragmentos" ya comunica salud
  pending: {
    label: "Pendiente",
    classes: "bg-muted text-muted-foreground border-border",
    icon: RefreshCw,
    tooltip: "El archivo aún no se indexó para búsqueda semántica.",
  },
  indexed: null,
  degraded: {
    label: "Degradado",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    icon: AlertCircle,
    tooltip: "Indexado solo en Postgres — Qdrant no respondió. La búsqueda funciona en modo texto pero pierde precisión semántica.",
  },
  failed: {
    label: "Falló",
    classes: "border-destructive/50 bg-destructive/10 text-destructive",
    icon: AlertOctagon,
    tooltip: "La indexación falló. El archivo no aparece en búsquedas — reintentá la subida.",
  },
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


export function EnterpriseSourcesPanel() {
  const { activeProject } = useProjectContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ total: number; completed: number; current: string } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterByProject, setFilterByProject] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/documents", { headers });
      const data: unknown = await res.json();
      if (!res.ok) {
        const error = apiErrorResponseSchema.safeParse(data);
        setError(error.success ? error.data.error : "Error al cargar documentos.");
      } else {
        const parsed = documentsResponseSchema.safeParse(data);
        if (!parsed.success) throw new Error("invalid /api/documents response");
        setFiles(parsed.data.files);
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

  const openFilePicker = () => fileInputRef.current?.click();

  const handleUpload = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setError(null);
    setUploadNotice(null);
    setUploading({ total: selectedFiles.length, completed: 0, current: selectedFiles[0]?.name ?? "" });

    try {
      const headers = await getAuthHeaders();
      if (activeProject?.id) headers["x-project-id"] = activeProject.id;

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index]!;
        setUploading({ total: selectedFiles.length, completed: index, current: file.name });

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", { method: "POST", body: formData, headers });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const parsedError = apiErrorResponseSchema.safeParse(data);
          const message = parsedError.success ? parsedError.data.error : "No se pudo procesar la fuente.";
          throw new Error(`${file.name}: ${message}`);
        }

        const parsedUpload = uploadResponseSchema.safeParse(data);
        if (!parsedUpload.success) throw new Error(`${file.name}: respuesta inválida del servidor.`);
      }

      setUploadNotice(`${selectedFiles.length} fuente${selectedFiles.length !== 1 ? "s" : ""} preparada${selectedFiles.length !== 1 ? "s" : ""} para lectura empresarial.`);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las fuentes.");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
      } else {
        const data: unknown = await res.json();
        const error = apiErrorResponseSchema.safeParse(data);
        setError(error.success ? error.data.error : "Error al eliminar el archivo.");
      }
    } catch {
      setError("Error al eliminar el archivo.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReindex = async (id: string) => {
    setReindexingId(id);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/documents/${id}/reindex`, { method: "POST", headers });
      const data: unknown = await res.json();
      if (!res.ok) {
        const error = apiErrorResponseSchema.safeParse(data);
        setError(error.success ? error.data.error : "Error al reindexar el archivo.");
        return;
      }

      const parsed = documentReindexResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error("invalid /api/documents/[id]/reindex response");
      await loadFiles();
    } catch {
      setError("Error al reindexar el archivo.");
    } finally {
      setReindexingId(null);
    }
  };

  const totalChunks = visibleFiles.reduce((s, f) => s + f.chunkCount, 0);
  const degradedCount = visibleFiles.filter((f) => f.indexing_status === "degraded").length;
  const failedCount = visibleFiles.filter((f) => f.indexing_status === "failed").length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-8 py-4">
        <Database className="h-4 w-4 text-primary" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Fuentes de Empresa</h1>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
            Ingreso, preparación y lectura de datos
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {visibleFiles.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {visibleFiles.length} fuente{visibleFiles.length !== 1 ? "s" : ""} · {totalChunks} fragmentos
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
          <Button
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={openFilePicker}
            disabled={Boolean(uploading)}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Cargar fuentes
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_EXTENSIONS}
          className="hidden"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            event.target.value = "";
            void handleUpload(selectedFiles);
          }}
        />

        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}

        <SourceIntakePanel
          fileCount={visibleFiles.length}
          totalChunks={totalChunks}
          observedCount={degradedCount + failedCount}
          projectName={filterByProject ? activeProject?.name : null}
          uploading={uploading}
          uploadNotice={uploadNotice}
          onUploadClick={openFilePicker}
        />

        {(degradedCount > 0 || failedCount > 0) && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[8px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px]">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-foreground">
              {failedCount > 0 && (
                <>
                  <strong className="text-destructive">{failedCount}</strong> fuente{failedCount !== 1 ? "s" : ""} sin indexar
                </>
              )}
              {failedCount > 0 && degradedCount > 0 && <span className="mx-2 text-muted-foreground">·</span>}
              {degradedCount > 0 && (
                <>
                  <strong className="text-amber-700 dark:text-amber-400">{degradedCount}</strong> degradado{degradedCount !== 1 ? "s" : ""}
                </>
              )}
            </span>
            <span className="text-muted-foreground">
              Cada fila muestra el detalle técnico y permite reindexar cuando corresponde.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Cargando fuentes…
          </div>
        ) : files.length === 0 ? (
          <EmptyState onUploadClick={openFilePicker} />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {visibleFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  deleting={deletingId === file.id}
                  reindexing={reindexingId === file.id}
                  onDelete={() => { void handleDelete(file.id); }}
                  onReindex={() => { void handleReindex(file.id); }}
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

function SourceIntakePanel({
  fileCount,
  totalChunks,
  observedCount,
  projectName,
  uploading,
  uploadNotice,
  onUploadClick,
}: {
  fileCount: number;
  totalChunks: number;
  observedCount: number;
  projectName: string | null | undefined;
  uploading: { total: number; completed: number; current: string } | null;
  uploadNotice: string | null;
  onUploadClick: () => void;
}) {
  return (
    <section className="mb-5 space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[8px] border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">Entrada empresarial</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Unificar datos reales, no acumular adjuntos</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Cada fuente entra al mismo flujo: preparación, clasificación, indexación, radar, mapa vivo y evidencia para expedientes.
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1.5" onClick={onUploadClick} disabled={Boolean(uploading)}>
              <UploadCloud className="h-3.5 w-3.5" />
              Cargar lote
            </Button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <IntakeMetric label="Fuentes leídas" value={fileCount.toString()} icon={Database} />
            <IntakeMetric label="Fragmentos" value={totalChunks.toString()} icon={Layers} />
            <IntakeMetric label="Observadas" value={observedCount.toString()} icon={AlertCircle} />
            <IntakeMetric label="Alcance" value={projectName ?? "Empresa"} icon={ShieldCheck} />
          </div>
        </div>

        <div className="rounded-[8px] border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Estado de ingreso</p>
          {uploading ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                Preparando {uploading.completed + 1}/{uploading.total}
              </div>
              <p className="truncate text-[12px] text-muted-foreground">{uploading.current}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(8, ((uploading.completed + 1) / uploading.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : uploadNotice ? (
            <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{uploadNotice}</span>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-[8px] border border-border bg-background p-3 text-sm text-muted-foreground">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Sin corrida activa. Las fuentes cargadas quedan disponibles para búsqueda y perfil empresarial.</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SOURCE_CHANNELS.map((channel) => (
          <SourceChannelCard key={channel.label} channel={channel} uploading={Boolean(uploading)} onUploadClick={onUploadClick} />
        ))}
      </div>
    </section>
  );
}

function IntakeMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SourceChannelCard({
  channel,
  uploading,
  onUploadClick,
}: {
  channel: (typeof SOURCE_CHANNELS)[number];
  uploading: boolean;
  onUploadClick: () => void;
}) {
  const Icon = channel.icon;
  return (
    <div className={`rounded-[8px] border p-3 ${channel.accent}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{channel.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{channel.meta}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${channel.enabled ? "border-primary/25 bg-primary/[0.07] text-primary" : "border-border bg-background text-muted-foreground"}`}>
          {channel.status}
        </span>
      </div>
      <p className="mt-3 min-h-10 text-[12px] leading-relaxed text-muted-foreground">{channel.description}</p>
      <Button
        variant={channel.enabled ? "outline" : "ghost"}
        size="sm"
        className="mt-3 h-7 w-full text-[11px]"
        onClick={onUploadClick}
        disabled={!channel.enabled || uploading}
      >
        {channel.enabled ? "Ingresar fuente" : "Preparado"}
      </Button>
    </div>
  );
}

function FileRow({
  file,
  deleting,
  reindexing,
  onDelete,
  onReindex,
  projectName,
}: {
  file: DocumentFile;
  deleting: boolean;
  reindexing: boolean;
  onDelete: () => void;
  onReindex: () => void;
  projectName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = TYPE_ICONS[file.file_type] ?? FileText;
  const colorClass = TYPE_COLOR[file.file_type] ?? TYPE_COLOR.other;
  const canReindex = file.indexing_status === "degraded" || file.indexing_status === "failed";

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

      {/* Indexing status — degraded/failed/pending */}
      {!confirming && file.indexing_status && INDEXING_BADGE[file.indexing_status] && (() => {
        const badge = INDEXING_BADGE[file.indexing_status]!;
        const tooltipBody = file.indexing_error ? `${badge.tooltip}\n\n${file.indexing_error}` : badge.tooltip;
        const Icon = badge.icon;
        return (
          <div
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.classes}`}
            title={tooltipBody}
          >
            <Icon className="h-3 w-3" />
            {badge.label}
          </div>
        );
      })()}

      {/* Chunk badge */}
      {file.chunkCount > 0 && !confirming && (
        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <Layers className="h-3 w-3" />
          {file.chunkCount} fragmentos
        </div>
      )}

      {/* Reindex + Delete / Confirm */}
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
        <div className="flex shrink-0 items-center gap-1">
          {canReindex && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:bg-primary/10 hover:text-primary"
              onClick={onReindex}
              disabled={reindexing}
              title="Reindexar archivo"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
            disabled={deleting || reindexing}
            title="Eliminar archivo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function EmptyState({ onUploadClick }: { onUploadClick: () => void }) {
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
        <p className="text-sm font-medium">Todavía no hay fuentes leídas</p>
        <p className="max-w-xs text-[12px] text-muted-foreground">
          Cargá el primer lote de archivos o exports para alimentar el radar y el mapa vivo de empresa.
        </p>
      </div>
      <Button size="sm" className="h-8 gap-1.5" onClick={onUploadClick}>
        <UploadCloud className="h-3.5 w-3.5" />
        Cargar fuentes
      </Button>
    </motion.div>
  );
}
