"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive, Cloud, Server, Table2, Boxes, Mail, Layers, UploadCloud,
  RefreshCw, ChevronDown, Plus, Pause, Play, Ban, ShieldCheck, AlertCircle,
  FileText, Clock3, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgMember } from "@/hooks/useOrgMember";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  apiErrorResponseSchema,
  enterpriseSourcesResponseSchema,
  enterpriseSourceMutationResponseSchema,
  enterpriseSourceDocumentsResponseSchema,
  type EnterpriseSourceSummary,
  type EnterpriseSourceDocumentsResponse,
} from "@/lib/validators/api-responses";

type SourceType = EnterpriseSourceSummary["sourceType"];
type SourceStatus = EnterpriseSourceSummary["status"];
type CatalogDocument = EnterpriseSourceDocumentsResponse["documents"][number];
type DocumentStructure = CatalogDocument["documentStructure"];

const TYPE_META: Record<SourceType, { label: string; icon: React.ElementType }> = {
  manual_upload: { label: "Carga manual", icon: UploadCloud },
  google_drive: { label: "Google Drive", icon: HardDrive },
  onedrive: { label: "OneDrive", icon: Cloud },
  sharepoint: { label: "SharePoint", icon: Cloud },
  dropbox: { label: "Dropbox", icon: Cloud },
  sql: { label: "SQL read-only", icon: Server },
  csv_export: { label: "Export CSV/XLSX", icon: Table2 },
  erp: { label: "ERP / compras", icon: Boxes },
  email: { label: "Email", icon: Mail },
  other: { label: "Otra fuente", icon: Layers },
};

const STATUS_META: Record<SourceStatus, { label: string; classes: string }> = {
  discovered: { label: "Descubierta", classes: "border-border bg-muted text-muted-foreground" },
  authorized: { label: "Autorizada", classes: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  syncing: { label: "Sincronizando", classes: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  active: { label: "Activa", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  paused: { label: "Pausada", classes: "border-border bg-muted text-muted-foreground" },
  error: { label: "Error", classes: "border-destructive/40 bg-destructive/10 text-destructive" },
  revoked: { label: "Revocada", classes: "border-border bg-muted text-muted-foreground line-through" },
};

const READINESS_LABEL: Record<string, string> = {
  descubierta: "Descubierta",
  inventariada: "Inventariada",
  clasificada: "Clasificada",
  normalizada: "Normalizada",
  indexada: "Indexada",
  operativa: "Operativa",
  observada: "Observada",
};

// Tipos declarables a mano (manual_upload se gestiona desde el ingreso de archivos).
const DECLARABLE_TYPES: SourceType[] = [
  "google_drive", "onedrive", "sharepoint", "dropbox", "sql", "csv_export", "erp", "email", "other",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function structureLabel(structure: DocumentStructure): string | null {
  if (!structure) return null;
  if (structure.status === "structured") {
    return `${structure.sectionCount} sección${structure.sectionCount !== 1 ? "es" : ""}`;
  }
  if (structure.status === "flat") return "Sin índice";
  if (structure.status === "scanned") return "Escaneado";
  return null;
}

function structureTitle(structure: DocumentStructure): string | undefined {
  if (!structure || structure.topSections.length === 0) return undefined;
  return structure.topSections.join("\n");
}

export function EnterpriseSourceRegistry() {
  const memberState = useOrgMember();
  const canManage = memberState.status === "ok" && (memberState.member.role === "admin" || memberState.member.role === "engineer");

  const [sources, setSources] = useState<EnterpriseSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/enterprise-context/sources", { headers });
      const data: unknown = await res.json();
      if (!res.ok) {
        const parsed = apiErrorResponseSchema.safeParse(data);
        setError(parsed.success ? parsed.data.error : "Error al cargar fuentes.");
        return;
      }
      const parsed = enterpriseSourcesResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error("invalid sources response");
      setSources(parsed.data.sources);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSources(); }, [loadSources]);

  const applyMutation = useCallback(async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const res = await fetch(`/api/enterprise-context/sources/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const parsed = apiErrorResponseSchema.safeParse(data);
        setError(parsed.success ? parsed.data.error : "No se pudo actualizar la fuente.");
        return;
      }
      const parsed = enterpriseSourceMutationResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error("invalid mutation response");
      setSources((prev) => prev.map((s) => (s.id === id ? parsed.data.source : s)));
    } catch {
      setError("No se pudo actualizar la fuente.");
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <section className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fuentes conectadas</h2>
          <p className="font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
            Registro read-only · estado de preparación por fuente
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={() => { void loadSources(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {canManage && (
            <Button
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={() => setDeclaring((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              Declarar fuente
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-[12px] text-destructive">{error}</p>}

      <AnimatePresence initial={false}>
        {declaring && canManage && (
          <DeclareSourceForm
            onClose={() => setDeclaring(false)}
            onCreated={(source) => {
              setSources((prev) => [...prev, source]);
              setDeclaring(false);
            }}
            onError={setError}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-[12px] text-muted-foreground">
          <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Cargando fuentes…
        </div>
      ) : sources.length === 0 ? (
        <p className="rounded-[8px] border border-dashed border-border bg-background px-4 py-6 text-center text-[12px] text-muted-foreground">
          Todavía no hay fuentes registradas. Cargá archivos o declará una fuente externa.
        </p>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              expanded={expandedId === source.id}
              busy={busyId === source.id}
              canManage={canManage}
              onToggle={() => setExpandedId((cur) => (cur === source.id ? null : source.id))}
              onStatus={(status) => { void applyMutation(source.id, { status }); }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SourceCard({
  source,
  expanded,
  busy,
  canManage,
  onToggle,
  onStatus,
}: {
  source: EnterpriseSourceSummary;
  expanded: boolean;
  busy: boolean;
  canManage: boolean;
  onToggle: () => void;
  onStatus: (status: SourceStatus) => void;
}) {
  const meta = TYPE_META[source.sourceType];
  const Icon = meta.icon;
  const statusMeta = STATUS_META[source.status];
  const isManual = source.sourceType === "manual_upload";

  return (
    <div className="rounded-[8px] border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <Icon className="h-4 w-4 text-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
            {source.readOnly && (
              <span className="hidden items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground sm:inline-flex">
                read-only
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>{meta.label}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{source.documentsTotal} doc{source.documentsTotal !== 1 ? "s" : ""}</span>
            {source.documentsObserved > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-amber-600 dark:text-amber-400">{source.documentsObserved} observada{source.documentsObserved !== 1 ? "s" : ""}</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span>sync {formatDate(source.lastSyncedAt)}</span>
          </div>
        </div>

        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusMeta.classes}`}>
          {statusMeta.label}
        </span>

        {canManage && !isManual && (
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            {source.status === "active" || source.status === "syncing" ? (
              <ActionIcon title="Pausar" icon={Pause} busy={busy} onClick={() => onStatus("paused")} />
            ) : source.status === "revoked" ? (
              <ActionIcon title="Reabrir" icon={Play} busy={busy} onClick={() => onStatus("discovered")} />
            ) : (
              <ActionIcon title="Activar" icon={Play} busy={busy} onClick={() => onStatus("active")} />
            )}
            {source.status !== "revoked" && (
              <ActionIcon title="Revocar" icon={Ban} busy={busy} destructive onClick={() => onStatus("revoked")} />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent/40 hover:text-foreground"
          title={expanded ? "Cerrar" : "Ver catálogo"}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {source.readiness.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-4 py-2">
          {source.readiness.map((r) => (
            <span
              key={r.status}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                r.status === "observada"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : r.status === "indexada" || r.status === "operativa"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {READINESS_LABEL[r.status] ?? r.status}: {r.count}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && <SourceCatalog sourceId={source.id} />}
      </AnimatePresence>
    </div>
  );
}

function ActionIcon({
  title,
  icon: Icon,
  busy,
  destructive,
  onClick,
}: {
  title: string;
  icon: React.ElementType;
  busy: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 text-muted-foreground/60 ${destructive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-primary/10 hover:text-primary"}`}
      onClick={onClick}
      disabled={busy}
      title={title}
    >
      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
    </Button>
  );
}

function SourceCatalog({ sourceId }: { sourceId: string }) {
  const [data, setData] = useState<EnterpriseSourceDocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/enterprise-context/sources/${sourceId}/documents`, { headers });
        const json: unknown = await res.json();
        if (!res.ok) {
          const parsed = apiErrorResponseSchema.safeParse(json);
          if (!cancelled) setError(parsed.success ? parsed.data.error : "Error al cargar el catálogo.");
          return;
        }
        const parsed = enterpriseSourceDocumentsResponseSchema.safeParse(json);
        if (!parsed.success) throw new Error("invalid catalog response");
        if (!cancelled) setData(parsed.data);
      } catch {
        if (!cancelled) setError("No se pudo cargar el catálogo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sourceId]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-border bg-background/50"
    >
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center py-3 text-[12px] text-muted-foreground">
            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Cargando catálogo…
          </div>
        ) : error ? (
          <p className="py-2 text-[12px] text-destructive">{error}</p>
        ) : data ? (
          <div className="space-y-3">
            {data.syncRuns.length > 0 && (
              <div>
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">Últimas corridas</p>
                <div className="space-y-1">
                  {data.syncRuns.slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3 shrink-0" />
                      <span className="text-foreground">{run.triggerType}</span>
                      <span>·</span>
                      <span>{run.status}</span>
                      <span>·</span>
                      <span>{run.indexedCount} indexados / {run.observedCount} observados</span>
                      <span className="ml-auto">{formatDate(run.startedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground">
                Catálogo · {data.meta.totalDocuments} documento{data.meta.totalDocuments !== 1 ? "s" : ""}
              </p>
              {data.documents.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">
                  Sin documentos leídos todavía. Aparecerán cuando esta fuente sincronice.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {data.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{doc.title}</span>
                      {structureLabel(doc.documentStructure) && (
                        <span
                          className="hidden shrink-0 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] text-muted-foreground md:inline"
                          title={structureTitle(doc.documentStructure)}
                        >
                          {structureLabel(doc.documentStructure)}
                        </span>
                      )}
                      {doc.projectName && (
                        <span className="hidden rounded-full border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 text-[9px] text-primary sm:inline">
                          {doc.projectName}
                        </span>
                      )}
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] ${
                          doc.readinessStatus === "observada"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : doc.readinessStatus === "indexada" || doc.readinessStatus === "operativa"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {READINESS_LABEL[doc.readinessStatus] ?? doc.readinessStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function DeclareSourceForm({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (source: EnterpriseSourceSummary) => void;
  onError: (msg: string | null) => void;
}) {
  const [sourceType, setSourceType] = useState<SourceType>("google_drive");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      onError("El nombre de la fuente es muy corto.");
      return;
    }
    setSubmitting(true);
    onError(null);
    try {
      const headers = { ...(await getAuthHeaders()), "Content-Type": "application/json" };
      const scopeList = scopes.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
      const res = await fetch("/api/enterprise-context/sources", {
        method: "POST",
        headers,
        body: JSON.stringify({ sourceType, name: name.trim(), scopes: scopeList }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const parsed = apiErrorResponseSchema.safeParse(data);
        onError(parsed.success ? parsed.data.error : "No se pudo declarar la fuente.");
        return;
      }
      const parsed = enterpriseSourceMutationResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error("invalid create response");
      onCreated(parsed.data.source);
    } catch {
      onError("No se pudo declarar la fuente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-3 overflow-hidden rounded-[8px] border border-primary/20 bg-primary/[0.03]"
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-primary" />
          <p className="text-[12px] font-medium text-foreground">Declarar fuente externa</p>
          <button type="button" onClick={onClose} className="ml-auto text-muted-foreground/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Registra una fuente read-only pendiente de conectar. El conector la poblará en una etapa posterior.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-muted-foreground">
            Tipo
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
            >
              {DECLARABLE_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Drive de obra · Torre Norte"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
            />
          </label>
        </div>
        <label className="block text-[11px] text-muted-foreground">
          Scopes / carpetas permitidas (opcional, separadas por coma)
          <input
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            placeholder="Obras/2026, Compras/Remitos"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 gap-1.5 px-3 text-[11px]" onClick={() => { void submit(); }} disabled={submitting}>
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Declarar
          </Button>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertCircle className="h-3 w-3" /> Queda en estado «Descubierta» hasta que se conecte.
          </span>
        </div>
      </div>
    </motion.div>
  );
}
