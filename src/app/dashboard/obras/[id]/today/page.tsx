"use client";

import { use } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CloudSun,
  HardHat,
  MessageSquare,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useDailyProjectBrief } from "@/hooks/useDailyProjectBrief";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { cn } from "@/lib/utils";
import type { DailyBriefResponse } from "@/lib/validators/api-responses";

type Brief = DailyBriefResponse;

const BUCKET_LABEL: Record<Brief["schedule"]["items"][number]["bucket"], string> = {
  overdue: "Vencida",
  due_today: "Hoy",
  due_soon: "Próxima",
  blocked: "Bloqueada",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  in_progress: "En curso",
  blocked: "Bloqueada",
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencido",
  missing: "Faltante",
  incident: "Incidente",
  planned: "Planificado",
  quoted: "Cotizado",
  ordered: "Pedido",
  partial: "Parcial",
  delayed: "Demorado",
};

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "Sin dato";
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

function riskTone(critical: number, warning: number) {
  if (critical > 0) return "border-[oklch(0.72_0.18_28)] bg-[oklch(0.98_0.03_28)] text-[oklch(0.46_0.16_28)]";
  if (warning > 0) return "border-[oklch(0.82_0.14_70)] bg-[oklch(0.98_0.04_75)] text-[oklch(0.48_0.14_65)]";
  return "border-border bg-card text-foreground";
}

export default function TodayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { projects, activateProject } = useProjectContext();
  const { data: details } = useProjectDetails(id);
  const briefQuery = useDailyProjectBrief(id, { includeWeather: true });

  const brief = briefQuery.data;
  const project = projects.find((p) => p.id === id);
  const projectName = brief?.projectName ?? details?.project.name ?? project?.name ?? "Obra";

  function handleChat() {
    if (project) activateProject(project);
    router.push("/dashboard/chat");
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-card px-8 py-5">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push(`/dashboard/obras/${id}` as Route)}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Detalle de obra
            </button>
            <span className="hidden text-muted-foreground/40 sm:inline">/</span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[20px] font-medium tracking-[-0.01em] text-foreground">
                Día en la obra · {projectName}
              </h1>
              {brief && (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Actualizado {formatDateTime(brief.generatedAt)}
                </p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => void briefQuery.refetch()}
                disabled={briefQuery.isFetching}
                title="Actualizar"
                className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4", briefQuery.isFetching && "animate-spin")} />
              </button>
              <button
                onClick={handleChat}
                className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <MessageSquare className="h-4 w-4" />
                Auditar lo nuevo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-8 py-8">
        {briefQuery.isLoading && <TodaySkeleton />}

        {briefQuery.isError && (
          <div className="rounded-[8px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            No se pudo cargar el brief diario de esta obra.
          </div>
        )}

        {brief && (
          <div className="space-y-6">
            <div className={cn("rounded-[8px] border px-5 py-4", riskTone(brief.alerts.critical, brief.alerts.warning))}>
              <div className="flex flex-wrap items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug">{brief.summary}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {brief.alerts.critical} críticas · {brief.alerts.warning} advertencias · {brief.alerts.info} informativas
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile
                icon={CalendarClock}
                label="Cronograma"
                value={brief.schedule.overdue + brief.schedule.dueToday + brief.schedule.blocked}
                sub={`${brief.schedule.overdue} vencidas · ${brief.schedule.blocked} bloqueadas`}
                alert={brief.schedule.overdue > 0 || brief.schedule.blocked > 0}
              />
              <MetricTile
                icon={ShieldCheck}
                label="HSE"
                value={brief.hse.expired + brief.hse.expiringSoon}
                sub={`${brief.hse.expired} vencidos · ${brief.hse.expiringSoon} por vencer`}
                alert={brief.hse.expired > 0}
              />
              <MetricTile
                icon={PackageCheck}
                label="Acopios"
                value={brief.supplies.delayed + brief.supplies.upcoming}
                sub={`${brief.supplies.delayed} demorados · ${brief.supplies.upcoming} próximos`}
                alert={brief.supplies.delayed > 0}
              />
              <MetricTile
                icon={Banknote}
                label="Curva S"
                value={brief.financial.deviationPct == null ? "S/D" : `${brief.financial.deviationPct}%`}
                sub={brief.financial.latestSnapshotDate ? formatDate(brief.financial.latestSnapshotDate) : "Sin snapshot"}
                alert={brief.financial.deviationPct != null && Math.abs(brief.financial.deviationPct) > 5}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
              <SectionPanel
                icon={CalendarClock}
                title="Tareas de hoy"
                right={`${brief.schedule.items.length} visibles`}
                empty={brief.schedule.items.length === 0 ? "Sin vencimientos ni bloqueos para hoy." : null}
              >
                {brief.schedule.items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.name}
                    kicker={item.code ?? "Sin código"}
                    meta={`${BUCKET_LABEL[item.bucket]} · ${formatDate(item.dueDate)} · ${item.progressPct}%`}
                    tone={item.bucket === "overdue" || item.bucket === "blocked" ? "danger" : item.bucket === "due_today" ? "warning" : "neutral"}
                  />
                ))}
              </SectionPanel>

              <SectionPanel
                icon={CloudSun}
                title="Clima operativo"
                right={brief.weather?.riskLevel ?? "sin dato"}
                empty={!brief.weather ? "Sin ubicación registrada para consultar clima." : null}
              >
                {brief.weather && (
                  <div className="grid grid-cols-2 gap-3">
                    <WeatherMetric label="Riesgo" value={brief.weather.riskLevel} />
                    <WeatherMetric label="Lluvia" value={brief.weather.precipitationMm == null ? "S/D" : `${brief.weather.precipitationMm} mm`} />
                    <WeatherMetric label="Viento" value={brief.weather.windKph == null ? "S/D" : `${brief.weather.windKph} km/h`} />
                    <WeatherMetric
                      label="Temperatura"
                      value={brief.weather.tempMinC == null || brief.weather.tempMaxC == null ? "S/D" : `${brief.weather.tempMinC}° / ${brief.weather.tempMaxC}°`}
                    />
                  </div>
                )}
              </SectionPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <SectionPanel
                icon={ShieldCheck}
                title="Legajos HSE"
                right={`${brief.hse.items.length}`}
                empty={brief.hse.items.length === 0 ? "Sin legajos vencidos ni próximos a vencer." : null}
              >
                {brief.hse.items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.subject}
                    kicker={item.recordType}
                    meta={`${STATUS_LABEL[item.status] ?? item.status} · ${item.daysToExpire == null ? "sin fecha" : `${item.daysToExpire} días`}`}
                    tone={item.status === "expired" || item.status === "missing" || item.status === "incident" ? "danger" : "warning"}
                  />
                ))}
              </SectionPanel>

              <SectionPanel
                icon={PackageCheck}
                title="Acopios"
                right={`${brief.supplies.items.length}`}
                empty={brief.supplies.items.length === 0 ? "Sin acopios demorados ni requeridos en 14 días." : null}
              >
                {brief.supplies.items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.itemName}
                    kicker={STATUS_LABEL[item.status] ?? item.status}
                    meta={`${formatDate(item.requiredBy)} · ${item.receivedPct == null ? "sin avance" : `${item.receivedPct}% recibido`}`}
                    tone={item.status === "delayed" ? "danger" : "neutral"}
                  />
                ))}
              </SectionPanel>

              <SectionPanel
                icon={Banknote}
                title="Finanzas"
                right={brief.financial.latestSnapshotDate ? formatDate(brief.financial.latestSnapshotDate) : "sin snapshot"}
                empty={null}
              >
                <FinanceLine label="Plan" value={formatMoney(brief.financial.plannedAmount, brief.financial.currency)} />
                <FinanceLine label="Real" value={formatMoney(brief.financial.actualAmount, brief.financial.currency)} />
                <FinanceLine label="Comprometido" value={formatMoney(brief.financial.committedAmount, brief.financial.currency)} />
                <FinanceLine
                  label="Desvío"
                  value={brief.financial.deviationPct == null ? "Sin dato" : `${brief.financial.deviationPct}%`}
                  alert={brief.financial.deviationPct != null && Math.abs(brief.financial.deviationPct) > 5}
                />
              </SectionPanel>
            </div>

            {brief.alerts.topTitles.length > 0 && (
              <SectionPanel icon={HardHat} title="Alertas recientes" right={`${brief.alerts.topTitles.length}`} empty={null}>
                {brief.alerts.topTitles.map((title) => (
                  <ListRow key={title} title={title} kicker="Proactividad" meta="Último escaneo registrado" tone="warning" />
                ))}
              </SectionPanel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  alert,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", alert ? "text-[oklch(0.58_0.18_35)]" : "text-primary")} strokeWidth={1.75} />
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-normal text-foreground">{value}</div>
      <p className="mt-2 truncate text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  right,
  empty,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  right: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{right}</span>
      </div>
      <div className="p-3">
        {empty ? (
          <div className="flex min-h-24 items-center justify-center rounded-[6px] border border-dashed border-border px-4 text-center text-[12px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" />
              {empty}
            </span>
          </div>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </div>
    </section>
  );
}

function ListRow({
  title,
  kicker,
  meta,
  tone,
}: {
  title: string;
  kicker: string;
  meta: string;
  tone: "danger" | "warning" | "neutral";
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[6px] border border-border bg-background px-3 py-2.5">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          tone === "danger" && "bg-[oklch(0.58_0.18_35)]",
          tone === "warning" && "bg-[oklch(0.72_0.16_70)]",
          tone === "neutral" && "bg-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-foreground">{title}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{kicker}</p>
      </div>
      <span className="max-w-[42%] truncate text-right text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-border bg-background px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-[16px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FinanceLine({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[6px] bg-background px-3 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right font-mono text-[12px] font-semibold", alert ? "text-[oklch(0.58_0.18_35)]" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-[8px] border border-border bg-card" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-[8px] border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="h-72 animate-pulse rounded-[8px] border border-border bg-card" />
        <div className="h-72 animate-pulse rounded-[8px] border border-border bg-card" />
      </div>
    </div>
  );
}
