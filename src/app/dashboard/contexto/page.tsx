"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  FileText,
  Link2,
  Network,
  RefreshCw,
  Search,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  enterpriseContextResponseSchema,
  type EnterpriseContextResponse,
} from "@/lib/validators/api-responses";
import { cn } from "@/lib/utils";

type DocumentResult = EnterpriseContextResponse["documents"][number];
type ProjectResult = EnterpriseContextResponse["projects"][number];
type WorkCaseResult = EnterpriseContextResponse["workCases"][number];
type RelationResult = EnterpriseContextResponse["relations"][number];

const READINESS_TONE: Record<DocumentResult["readinessStatus"], string> = {
  descubierta: "border-muted bg-muted/60 text-muted-foreground",
  inventariada: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  clasificada: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  normalizada: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  indexada: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  operativa: "border-primary/30 bg-primary/10 text-primary",
  observada: "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const VERDICT_LABEL: Record<string, string> = {
  approved: "Aprobado",
  flagged: "Observado",
  inconclusive: "Inconcluso",
  rejected: "Rechazado",
  superseded: "Reemplazado",
};

export default function EnterpriseContextPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const contextQuery = useQuery({
    queryKey: ["enterprise-context", query],
    staleTime: 45_000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return null;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/enterprise-context/search${suffix}`, { headers });
      if (!res.ok) return null;
      const parsed = enterpriseContextResponseSchema.safeParse(await res.json());
      return parsed.success ? parsed.data : null;
    },
  });

  const data = contextQuery.data;
  const observedRatio = data && data.summary.documents > 0
    ? Math.round((data.summary.observed / data.summary.documents) * 100)
    : 0;
  const indexedRatio = data && data.summary.documents > 0
    ? Math.round((data.summary.indexed / data.summary.documents) * 100)
    : 0;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Activity className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Inteligencia Empresarial
              </p>
              <h1 className="mt-1 font-display text-[24px] font-medium leading-tight text-foreground">
                Radar de Evidencia
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void contextQuery.refetch()}
              disabled={contextQuery.isFetching}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-[8px] border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", contextQuery.isFetching && "animate-spin")} />
              Actualizar
            </button>
          </div>

          <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Obra, proveedor, contrato, rubro, documento, expediente o contradicción..."
                className="h-11 w-full rounded-[8px] border border-border bg-background pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-[8px] bg-primary px-5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Analizar
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-8 py-8">
        {data && (
          <section className="rounded-[10px] border border-border bg-card">
            <div className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-6 md:divide-y-0">
              <Metric label="Fuentes" value={data.summary.sources} />
              <Metric label="Documentos" value={data.summary.documents} />
              <Metric label="Indexación" value={`${indexedRatio}%`} />
              <Metric label="Observados" value={`${observedRatio}%`} tone={observedRatio > 0 ? "warn" : "neutral"} />
              <Metric label="Obras" value={data.summary.projects} />
              <Metric label="Expedientes" value={data.summary.workCases} />
            </div>
          </section>
        )}

        {contextQuery.isLoading && <LoadingState />}
        {!contextQuery.isLoading && !data && (
          <div className="rounded-[8px] border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
            No se pudo cargar la inteligencia empresarial.
          </div>
        )}

        {data && (
          <>
            <SynthesisPanel data={data} query={query} />

            <ResultSection
              title="Evidencia documental"
              description="Documentos, reportes y señales que sostienen la lectura."
              count={data.documents.length}
              icon={<FileText className="h-4 w-4" />}
            >
              {data.documents.length === 0 ? (
                <EmptyState text="No hay evidencia documental para esta búsqueda." />
              ) : (
                <div className="divide-y divide-border">
                  {data.documents.map((doc) => (
                    <DocumentRow key={doc.id} item={doc} />
                  ))}
                </div>
              )}
            </ResultSection>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <ResultSection
                title="Obras impactadas"
                description="Dónde aparece la señal dentro de la operación."
                count={data.projects.length}
                icon={<Building2 className="h-4 w-4" />}
              >
                {data.projects.length === 0 ? (
                  <EmptyState text="Sin obras asociadas." />
                ) : (
                  <div className="divide-y divide-border">
                    {data.projects.map((project) => (
                      <ProjectRow key={project.id} item={project} onOpen={() => router.push(`/dashboard/obras/${project.id}` as Route)} />
                    ))}
                  </div>
                )}
              </ResultSection>

              <ResultSection
                title="Expedientes vinculados"
                description="Casos operativos relacionados; se gestionan en la mesa de Expedientes."
                count={data.workCases.length}
                icon={<BriefcaseBusiness className="h-4 w-4" />}
              >
                {data.workCases.length === 0 ? (
                  <EmptyState text="Sin expedientes relacionados." />
                ) : (
                  <div className="divide-y divide-border">
                    {data.workCases.map((workCase) => (
                      <WorkCaseRow
                        key={workCase.id}
                        item={workCase}
                        onOpen={() => {
                          if (workCase.projectId) router.push(`/dashboard/obras/${workCase.projectId}/expedientes/${workCase.id}` as Route);
                        }}
                      />
                    ))}
                  </div>
                )}
              </ResultSection>
            </div>

            <ResultSection
              title="Trazabilidad entre documentos"
              description="Contradicciones, reemplazos, versiones y derivaciones detectadas."
              count={data.relations.length}
              icon={<Network className="h-4 w-4" />}
            >
              {data.relations.length === 0 ? (
                <EmptyState text="No se encontraron relaciones documentales asociadas." />
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
                  {data.relations.map((relation) => (
                    <RelationRow key={relation.id} item={relation} />
                  ))}
                </div>
              )}
            </ResultSection>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "warn" }) {
  return (
    <div className="px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-[17px] font-semibold text-foreground", tone === "warn" && "text-amber-600 dark:text-amber-300")}>
        {value}
      </p>
    </div>
  );
}

function SynthesisPanel({ data, query }: { data: EnterpriseContextResponse; query: string }) {
  const hasRisk = data.summary.observed > 0 || data.relations.length > 0;
  const mainDocument = data.documents[0];
  const mainProject = data.projects[0];
  const mainWorkCase = data.workCases[0];
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[10px] border border-border bg-card px-4 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[8px]",
            hasRisk ? "bg-amber-500/10 text-amber-600 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
          )}>
            {hasRisk ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Lectura ejecutiva
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground">
              {query
                ? `La búsqueda "${query}" cruza evidencia documental, obras, expedientes y relaciones para devolver una lectura operativa.`
                : "El radar consolida las señales vivas de la empresa: documentos disponibles, cobertura de obras, expedientes abiertos y vínculos entre evidencias."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill label={hasRisk ? "Requiere atención" : "Sin señales críticas"} tone={hasRisk ? "warn" : "ok"} />
              {mainDocument && <Pill label={`Evidencia: ${mainDocument.readinessStatus}`} />}
              {mainProject && <Pill label={`Obra: ${mainProject.name}`} />}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-[10px] border border-border bg-card px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Principal vínculo operativo</p>
        {mainWorkCase ? (
          <div className="mt-3">
            <p className="line-clamp-2 text-[14px] font-semibold text-foreground">{mainWorkCase.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {mainWorkCase.kind} · {mainWorkCase.status}
              {mainWorkCase.projectName ? ` · ${mainWorkCase.projectName}` : ""}
            </p>
            <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">{mainWorkCase.why}</p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            No hay expediente asociado a esta señal. Si la evidencia requiere acción, debería abrirse desde una obra o conversación.
          </p>
        )}
      </div>
    </section>
  );
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warn" | "ok" }) {
  return (
    <span className={cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-medium",
      tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      tone === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      tone === "neutral" && "border-border bg-muted/50 text-muted-foreground",
    )}>
      {label}
    </span>
  );
}

function ResultSection({
  title,
  description,
  count,
  icon,
  children,
}: {
  title: string;
  description: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <span className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function DocumentRow({ item }: { item: DocumentResult }) {
  const confidence = item.confidence == null ? null : Math.round(item.confidence * 100);
  const issueCount = item.findingsCount + item.risksCount;
  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_170px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">{item.title}</p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", READINESS_TONE[item.readinessStatus])}>
              {item.readinessStatus}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.documentType}
            {item.projectName ? ` · ${item.projectName}` : ""}
            {item.sourceName ? ` · ${item.sourceName}` : ""}
            {item.sourcePath ? ` · ${item.sourcePath}` : ""}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{item.why}</p>
        </div>
        <div className="rounded-[8px] border border-border bg-background px-3 py-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Estado</p>
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <StatusLine label="Confianza" value={confidence != null ? `${confidence}%` : "Sin dato"} />
            <StatusLine label="Veredicto" value={item.reportVerdict ? VERDICT_LABEL[item.reportVerdict] ?? item.reportVerdict : "Sin reporte"} />
            <StatusLine label="Alertas" value={issueCount > 0 ? `${issueCount}` : "0"} tone={issueCount > 0 ? "warn" : "neutral"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={cn("font-medium text-foreground", tone === "warn" && "text-amber-600 dark:text-amber-300")}>{value}</span>
    </div>
  );
}

function ProjectRow({ item, onOpen }: { item: ProjectResult; onOpen: () => void }) {
  const hasObserved = item.observedCount > 0;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/40">
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">{item.name}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {item.status}{item.location ? ` · ${item.location}` : ""}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          <Pill label={`${item.documentCount} doc(s)`} />
          {hasObserved && <Pill label={`${item.observedCount} observado(s)`} tone="warn" />}
        </span>
        <span className="mt-2 block text-[12px] leading-relaxed text-muted-foreground">{item.why}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function WorkCaseRow({ item, onOpen }: { item: WorkCaseResult; onOpen: () => void }) {
  const disabled = !item.projectId;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground">{item.title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {item.kind} · {item.status}{item.projectName ? ` · ${item.projectName}` : ""}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {item.verdict && <Pill label={VERDICT_LABEL[item.verdict] ?? item.verdict} />}
          <Pill label={item.projectId ? "Vinculado a obra" : "Sin obra asociada"} tone={item.projectId ? "ok" : "neutral"} />
        </span>
        <span className="mt-2 block text-[12px] leading-relaxed text-muted-foreground">{item.why}</span>
      </span>
      {!disabled && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function RelationRow({ item }: { item: RelationResult }) {
  return (
    <div className="rounded-[8px] border border-border bg-background px-3 py-3">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground">{item.relationType}</p>
            <Pill label={`${Math.round(item.confidence * 100)}%`} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.sourceFileName ?? "Documento origen"} {"->"} {item.targetFileName ?? "Documento destino"}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{item.why}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-[10px] border border-border bg-card" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</div>;
}
