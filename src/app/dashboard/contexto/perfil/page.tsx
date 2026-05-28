"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  Building2,
  ClipboardList,
  GaugeCircle,
  Hammer,
  Languages,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  enterpriseProfileResponseSchema,
  enterpriseProfileRefreshResponseSchema,
  type EnterpriseProfileResponse,
} from "@/lib/validators/api-responses";
import { cn } from "@/lib/utils";

type EntityRow = EnterpriseProfileResponse["entities"][number];
type PatternRow = EnterpriseProfileResponse["patterns"][number];
type CoverageRow = EnterpriseProfileResponse["coverage"][number];

const ENTITY_ICONS: Record<EntityRow["entityType"], ReactNode> = {
  supplier: <Truck className="h-3.5 w-3.5" strokeWidth={1.75} />,
  subcontractor: <Users className="h-3.5 w-3.5" strokeWidth={1.75} />,
  trade: <Hammer className="h-3.5 w-3.5" strokeWidth={1.75} />,
  location: <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
  cost_center: <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />,
  document_type: <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />,
  currency: <GaugeCircle className="h-3.5 w-3.5" strokeWidth={1.75} />,
  naming_convention: <Languages className="h-3.5 w-3.5" strokeWidth={1.75} />,
};

const ENTITY_LABEL: Record<EntityRow["entityType"], string> = {
  supplier: "Proveedor",
  subcontractor: "Subcontratista",
  trade: "Rubro",
  location: "Ubicación",
  cost_center: "Centro de costo",
  document_type: "Tipo documental",
  currency: "Moneda",
  naming_convention: "Convención",
};

const PATTERN_LABEL: Record<PatternRow["patternKind"], string> = {
  naming_convention: "Convención de nombre",
  document_format: "Formato documental",
  currency: "Moneda predominante",
  trade_vocabulary: "Rubro recurrente",
  source_reliability: "Confiabilidad de fuente",
  frequent_supplier: "Proveedor habitual",
  frequent_subcontractor: "Subcontratista habitual",
  sensitivity_default: "Sensibilidad por defecto",
};

const RISK_TONE: Record<CoverageRow["riskLevel"], string> = {
  bajo: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medio: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  alto: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  critico: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export default function EnterpriseProfilePage() {
  const queryClient = useQueryClient();
  const [activeEntityType, setActiveEntityType] = useState<EntityRow["entityType"] | "all">("all");

  const profileQuery = useQuery({
    queryKey: ["enterprise-profile"],
    staleTime: 60_000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return null;
      const res = await fetch("/api/enterprise-context/profile", { headers });
      if (!res.ok) return null;
      const parsed = enterpriseProfileResponseSchema.safeParse(await res.json());
      return parsed.success ? parsed.data : null;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) throw new Error("missing auth");
      const res = await fetch("/api/enterprise-context/profile/refresh", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
      });
      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`refresh failed: ${res.status} ${errorBody}`.trim());
      }
      const parsed = enterpriseProfileRefreshResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid refresh response");
      return parsed.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["enterprise-profile"] });
    },
  });

  const data = profileQuery.data;
  const entities = useMemo<EntityRow[]>(() => data?.entities ?? [], [data]);
  const filteredEntities = useMemo(
    () => (activeEntityType === "all" ? entities : entities.filter((entity) => entity.entityType === activeEntityType)),
    [entities, activeEntityType],
  );
  const entityTypeCounts = useMemo(() => {
    const counts = new Map<EntityRow["entityType"], number>();
    for (const entity of entities) counts.set(entity.entityType, (counts.get(entity.entityType) ?? 0) + 1);
    return counts;
  }, [entities]);

  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-card/92 px-4 py-5 backdrop-blur md:px-8 md:py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <Building2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">
              Mapa Vivo de Empresa
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Entidades · patrones · cobertura · riesgo
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {data?.meta.latestSnapshotAt && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Snapshot v{data.meta.latestSnapshotVersion} · {new Date(data.meta.latestSnapshotAt).toLocaleString("es-AR")}
              </span>
            )}
            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || profileQuery.isFetching}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className={cn("h-3.5 w-3.5", refreshMutation.isPending && "animate-pulse")} />
              {refreshMutation.isPending ? "Recalculando…" : "Recalcular perfil"}
            </button>
            <button
              type="button"
              onClick={() => void profileQuery.refetch()}
              disabled={profileQuery.isFetching}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", profileQuery.isFetching && "animate-spin")} />
              Refrescar
            </button>
          </div>
        </div>
        {refreshMutation.isError && (
          <div className="mx-auto mt-4 max-w-6xl rounded-[8px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            No se pudo recalcular el perfil. Revisá los logs y volvé a intentar.
          </div>
        )}
        {refreshMutation.isSuccess && (
          <div className="mx-auto mt-4 max-w-6xl rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">
            Perfil actualizado a v{refreshMutation.data?.version}. {refreshMutation.data?.entityCount} entidades · {refreshMutation.data?.patternCount} patrones · {refreshMutation.data?.coverageCount} obras.
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        {profileQuery.isLoading && <LoadingState />}

        {!profileQuery.isLoading && !data && (
          <div className="rounded-[8px] border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
            No se pudo cargar el perfil. Probá recalcular para generarlo desde los datos actuales.
          </div>
        )}

        {data && (
          <>
            <section className="rounded-[10px] border border-border bg-card px-4 py-4 shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Resumen vivo</p>
              <p className="mt-2 text-[14px] leading-relaxed text-foreground">{data.summary.text}</p>
            </section>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Metric label="Obras" value={data.summary.projectsCount} />
              <Metric label="Entidades" value={data.summary.entityCount} />
              <Metric label="Patrones" value={data.summary.patternCount} />
              <Metric label="Cobertura" value={data.summary.coverageCount} />
              <Metric label="Riesgo alto" value={data.summary.riskyProjects} tone={data.summary.riskyProjects > 0 ? "warn" : "neutral"} />
              <Metric label="Moneda" value={data.summary.dominantCurrency ?? "—"} />
            </div>

            <Section title="Entidades detectadas" icon={<Users className="h-4 w-4" />} count={entities.length}>
              <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2">
                <EntityFilter
                  active={activeEntityType === "all"}
                  label={`Todas (${entities.length})`}
                  onClick={() => setActiveEntityType("all")}
                />
                {(Object.keys(ENTITY_LABEL) as EntityRow["entityType"][]).map((type) => {
                  const count = entityTypeCounts.get(type) ?? 0;
                  if (count === 0) return null;
                  return (
                    <EntityFilter
                      key={type}
                      active={activeEntityType === type}
                      label={`${ENTITY_LABEL[type]} (${count})`}
                      onClick={() => setActiveEntityType(type)}
                    />
                  );
                })}
              </div>
              {filteredEntities.length === 0 ? (
                <EmptyState text="Sin entidades detectadas todavía." />
              ) : (
                <div className="grid gap-2 px-4 py-3 md:grid-cols-2">
                  {filteredEntities.slice(0, 80).map((entity) => (
                    <EntityCard key={entity.id} entity={entity} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Patrones internos" icon={<Sparkles className="h-4 w-4" />} count={data.patterns.length}>
              {data.patterns.length === 0 ? (
                <EmptyState text="No se detectaron patrones todavía." />
              ) : (
                <div className="divide-y divide-border">
                  {data.patterns.map((pattern) => (
                    <PatternRowView key={pattern.id} pattern={pattern} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Cobertura por obra" icon={<GaugeCircle className="h-4 w-4" />} count={data.coverage.length}>
              {data.coverage.length === 0 ? (
                <EmptyState text="Sin cobertura calculada. Recalculá el perfil para generarla." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <Th>Obra</Th>
                        <Th>Score</Th>
                        <Th>Riesgo</Th>
                        <Th>Docs</Th>
                        <Th>Subcontratos</Th>
                        <Th>Acopios</Th>
                        <Th>HSE</Th>
                        <Th>Cronograma</Th>
                        <Th>Hallazgos</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coverage.map((row) => (
                        <CoverageTableRow key={row.projectId} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "warn" }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-4 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-[16px] font-semibold", tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: ReactNode; count: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-primary">{icon}</span>
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function EntityFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/40",
      )}
    >
      {label}
    </button>
  );
}

function EntityCard({ entity }: { entity: EntityRow }) {
  const confidencePct = entity.confidence == null ? null : Math.round(entity.confidence * 100);
  return (
    <div className="rounded-[8px] border border-border bg-background px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-primary">{ENTITY_ICONS[entity.entityType]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-foreground">{entity.displayName}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {ENTITY_LABEL[entity.entityType]}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {entity.occurrenceCount} ocurrencia(s)
            {confidencePct != null ? ` · confianza ${confidencePct}%` : ""}
            {entity.lastSeenAt ? ` · último ${new Date(entity.lastSeenAt).toLocaleDateString("es-AR")}` : ""}
          </p>
          {entity.aliases.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              alias: {entity.aliases.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PatternRowView({ pattern }: { pattern: PatternRow }) {
  const value = pattern.patternValue ?? {};
  const display = formatPatternValue(pattern.patternKind, value);
  const confidencePct = Math.round(pattern.confidence * 100);
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary">
          <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">{PATTERN_LABEL[pattern.patternKind]}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {pattern.patternKey}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              confianza {confidencePct}%
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">{display}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {pattern.evidenceCount} evidencia(s)
            {pattern.lastObservedAt ? ` · última observación ${new Date(pattern.lastObservedAt).toLocaleDateString("es-AR")}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function CoverageTableRow({ row }: { row: CoverageRow }) {
  const scorePct = Math.round(row.coverageScore * 100);
  return (
    <tr className="border-b border-border last:border-b-0">
      <Td>
        <div className="flex flex-col">
          <span className="text-[12px] font-semibold text-foreground">{row.projectName ?? row.projectId.slice(0, 8)}</span>
          {row.projectStatus && (
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">{row.projectStatus}</span>
          )}
        </div>
      </Td>
      <Td>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                scorePct >= 70 ? "bg-emerald-500" : scorePct >= 40 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-foreground">{scorePct}%</span>
        </div>
      </Td>
      <Td>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]", RISK_TONE[row.riskLevel])}>
          {row.riskLevel}
        </span>
      </Td>
      <Td>
        {row.documentsTotal}
        {row.documentsObserved > 0 && (
          <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">({row.documentsObserved} obs.)</span>
        )}
      </Td>
      <Td>{row.subcontractsCount}</Td>
      <Td>{row.suppliesCount}</Td>
      <Td>{row.hseRecordsCount}</Td>
      <Td>{row.scheduleTasksCount}</Td>
      <Td>
        {row.findingsOpen > 0 ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 dark:text-red-400">
            <AlertOctagon className="h-3 w-3" strokeWidth={1.75} />
            {row.findingsOpen}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-[12px] text-foreground">{children}</td>;
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-[10px] border border-border bg-card" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</div>;
}

function formatPatternValue(kind: PatternRow["patternKind"], value: Record<string, unknown>): string {
  switch (kind) {
    case "naming_convention": {
      const examples = Array.isArray(value.examples) ? (value.examples as string[]).slice(0, 3).join(", ") : "";
      const share = typeof value.share === "number" ? `${Math.round(value.share * 100)}% de las obras` : "";
      return [share, examples ? `ejemplos: ${examples}` : ""].filter(Boolean).join(" · ");
    }
    case "currency":
      return `Moneda dominante ${String(value.currency ?? "")} (${String(value.occurrenceCount ?? "")} registros)`;
    case "frequent_supplier":
    case "frequent_subcontractor":
    case "trade_vocabulary":
    case "document_format":
      return `${String(value.displayName ?? "")} · ${String(value.occurrenceCount ?? "")} ocurrencia(s)`;
    case "source_reliability": {
      const indexed = typeof value.indexedShare === "number" ? `${Math.round(value.indexedShare * 100)}% indexado` : "";
      const observed = typeof value.observedShare === "number" ? `${Math.round(value.observedShare * 100)}% observado` : "";
      return [indexed, observed, value.totalDocs ? `${String(value.totalDocs)} docs` : ""].filter(Boolean).join(" · ");
    }
    default:
      return JSON.stringify(value);
  }
}
