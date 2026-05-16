"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Brain, FileSpreadsheet, FileText, Box, ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useOrgMember } from "@/hooks/useOrgMember";
import { getAuthHeaders } from "@/lib/insforge/client";

interface PatternRow {
  document_type: string;
  pattern_key: string;
  pattern_value: unknown;
  sample_count: number;
  updated_at: string;
}

interface GroupedPatterns {
  patterns: PatternRow[];
  maxSampleCount: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  excel: "Excel / Presupuestos",
  pdf: "PDF / Documentos",
  dxf: "DXF / Planos",
  docx: "Word / Memorias",
};

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  excel: <FileSpreadsheet className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
  dxf: <Box className="h-4 w-4" />,
  docx: <FileText className="h-4 w-4" />,
};

const PATTERN_KEY_LABELS: Record<string, string> = {
  price_ranges: "Rango de precios unitarios",
  column_aliases: "Estructura de columnas",
  rubro_structure: "Estructura de rubros",
  markup_items: "Ítems de overhead / imprevistos",
  subcontracted_ratio: "Proporción de subcontratos",
  layer_conventions: "Convenciones de capas DXF",
  entity_distribution: "Distribución de entidades",
  block_library: "Biblioteca de bloques",
  section_titles: "Títulos de secciones",
  vocabulary_domain: "Dominio de vocabulario",
  page_count: "Páginas promedio",
  structure: "Estructura de documento",
  word_density: "Densidad de palabras",
};

export default function PatternsPage() {
  const orgMember = useOrgMember();
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, GroupedPatterns>>({});
  const [totalPatterns, setTotalPatterns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return;
      const res = await fetch("/api/admin/patterns", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as {
        grouped: Record<string, GroupedPatterns>;
        totalPatterns: number;
      };
      setGrouped(data.grouped);
      setTotalPatterns(data.totalPatterns);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgMember.status === "ok" && orgMember.member.role !== "admin") {
      router.replace("/dashboard/chat");
      return;
    }
    if (orgMember.status === "ok") void fetchPatterns();
    if (orgMember.status === "error") setLoading(false);
  }, [orgMember, fetchPatterns, router]);

  const handleDeletePattern = async (documentType: string, patternKey: string) => {
    const key = `${documentType}:${patternKey}`;
    setDeleting(key);
    // Optimistic update
    setGrouped((prev) => {
      const next = { ...prev };
      if (next[documentType]) {
        const filtered = next[documentType]!.patterns.filter((p) => p.pattern_key !== patternKey);
        if (filtered.length === 0) {
          const { [documentType]: _, ...rest } = next;
          void _;
          return rest;
        }
        next[documentType] = { ...next[documentType]!, patterns: filtered };
      }
      return next;
    });
    setTotalPatterns((n) => n - 1);
    await fetch("/api/admin/patterns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ documentType, patternKey }),
    });
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const docTypes = Object.keys(grouped);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            Lo que EdificIA aprendió de tu empresa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Patrones extraídos automáticamente de los documentos que subiste.
            El agente usa este contexto al analizar nuevos archivos.
          </p>
        </div>
        <button
          onClick={() => { void fetchPatterns(); }}
          className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Actualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalPatterns}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Patrones aprendidos</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{docTypes.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tipos de documento</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {Math.max(...Object.values(grouped).map((g) => g.maxSampleCount), 0)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Documentos procesados</p>
        </div>
      </div>

      {/* Pattern groups */}
      {docTypes.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Brain className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Sin patrones todavía</p>
          <p className="text-xs text-muted-foreground mt-1">
            Subí documentos desde el chat para que EdificIA comience a aprender el formato de tu empresa.
          </p>
        </div>
      ) : (
        docTypes.map((docType) => {
          const group = grouped[docType]!;
          return (
            <section key={docType} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/30">
                <span className="text-muted-foreground">
                  {DOC_TYPE_ICONS[docType] ?? <FileText className="h-4 w-4" />}
                </span>
                <h2 className="text-sm font-semibold">
                  {DOC_TYPE_LABELS[docType] ?? docType}
                </h2>
                <span className="ml-auto rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  {group.maxSampleCount} archivo{group.maxSampleCount !== 1 ? "s" : ""} procesado{group.maxSampleCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y">
                {group.patterns.map((row) => {
                  const deleteKey = `${docType}:${row.pattern_key}`;
                  const isAdmin = orgMember.status === "ok" && orgMember.member.role === "admin";
                  return (
                    <div key={row.pattern_key} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {PATTERN_KEY_LABELS[row.pattern_key] ?? row.pattern_key}
                          </p>
                          <PatternValueDisplay patternKey={row.pattern_key} value={row.pattern_value} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">
                              {row.sample_count}× visto
                            </span>
                            <div className="mt-1 h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, (row.sample_count / Math.max(group.maxSampleCount, 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => { void handleDeletePattern(docType, row.pattern_key); }}
                              disabled={deleting === deleteKey}
                              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                              title="Eliminar patrón"
                            >
                              {deleting === deleteKey
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {lastUpdated && (
        <p className="text-center text-xs text-muted-foreground">
          Actualizado {lastUpdated.toLocaleTimeString("es-AR")}
        </p>
      )}

      <button
        onClick={() => router.push("/dashboard/admin")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al panel de administración
      </button>
    </div>
  );
}

function PatternValueDisplay({ patternKey, value }: { patternKey: string; value: unknown }) {
  if (patternKey === "price_ranges" && value && typeof value === "object") {
    const pr = value as { min?: number; max?: number; avg?: number };
    return (
      <p className="text-sm text-foreground">
        ${(pr.min ?? 0).toLocaleString("es-AR")} – ${(pr.max ?? 0).toLocaleString("es-AR")}
        {pr.avg ? <span className="text-muted-foreground"> (promedio ${Math.round(pr.avg).toLocaleString("es-AR")})</span> : null}
      </p>
    );
  }

  if (patternKey === "column_aliases" && value && typeof value === "object") {
    const ca = value as { units?: string[]; code_prefix_set?: string[] };
    return (
      <div className="space-y-1">
        {ca.units && ca.units.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Unidades: </span>
            {ca.units.join(", ")}
          </p>
        )}
        {ca.code_prefix_set && ca.code_prefix_set.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Prefijos de rubro: </span>
            {ca.code_prefix_set.join(", ")}
          </p>
        )}
      </div>
    );
  }

  if (patternKey === "layer_conventions" && Array.isArray(value)) {
    return (
      <p className="text-sm text-foreground">
        {(value as string[]).slice(0, 8).join(", ")}
        {value.length > 8 ? <span className="text-muted-foreground"> +{value.length - 8} más</span> : null}
      </p>
    );
  }

  if (patternKey === "subcontracted_ratio" && typeof value === "number") {
    return (
      <p className="text-sm text-foreground">
        {Math.round(value * 100)}% de los ítems son subcontratos
      </p>
    );
  }

  if (patternKey === "vocabulary_domain" && typeof value === "string") {
    const labels: Record<string, string> = {
      presupuesto: "Presupuesto / Costo",
      pliego: "Pliego de condiciones",
      memoria: "Memoria descriptiva",
      plano: "Documentación de planos",
      general: "Documento general",
    };
    return <p className="text-sm text-foreground">{labels[value] ?? value}</p>;
  }

  if (patternKey === "rubro_structure" && value && typeof value === "object") {
    const rs = value as { item_count?: number; has_declared_total?: boolean };
    return (
      <p className="text-sm text-foreground">
        {rs.item_count} ítems
        {rs.has_declared_total ? " · incluye total declarado" : " · sin total declarado"}
      </p>
    );
  }

  if (Array.isArray(value)) {
    return (
      <p className="text-sm text-foreground">
        {(value as string[]).slice(0, 5).join(", ")}
        {value.length > 5 ? <span className="text-muted-foreground"> +{value.length - 5} más</span> : null}
      </p>
    );
  }

  return (
    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
