import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

const DAY_MS = 86_400_000;

export interface DailyBriefInput {
  organizationId: string;
  projectId: string;
  now?: Date;
  includeWeather?: { location?: string; latitude?: number; longitude?: number };
}

interface ScheduleRow {
  id: string;
  task_code: string | null;
  name: string;
  status: string;
  due_date: string | null;
  progress_pct: number | string | null;
}

interface HseRow {
  id: string;
  subject_name: string | null;
  subcontractor_name: string | null;
  record_type: string;
  status: string;
  expires_at: string | null;
}

interface SupplyRow {
  id: string;
  item_name: string;
  status: string;
  required_by: string | null;
  required_quantity: number | string | null;
  received_quantity: number | string | null;
}

interface FinancialRow {
  snapshot_date: string;
  planned_amount: number | string | null;
  actual_amount: number | string | null;
  committed_amount: number | string | null;
  currency: string;
}

interface ProactivityRow {
  severity: string;
  title: string;
  last_detected_at: string;
}

export interface DailyBriefResult {
  found: boolean;
  projectId: string;
  projectName: string;
  generatedAt: string;
  schedule: {
    overdue: number;
    dueToday: number;
    dueNext7Days: number;
    blocked: number;
    items: Array<{ id: string; code: string | null; name: string; dueDate: string | null; status: string; progressPct: number; bucket: "overdue" | "due_today" | "due_soon" | "blocked" }>;
  };
  hse: {
    expiringSoon: number;
    expired: number;
    items: Array<{ id: string; subject: string; recordType: string; expiresAt: string | null; status: string; daysToExpire: number | null }>;
  };
  supplies: {
    delayed: number;
    upcoming: number;
    items: Array<{ id: string; itemName: string; requiredBy: string | null; status: string; receivedPct: number | null }>;
  };
  financial: {
    latestSnapshotDate: string | null;
    plannedAmount: number | null;
    actualAmount: number | null;
    committedAmount: number | null;
    deviationPct: number | null;
    currency: string;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
    topTitles: string[];
  };
  weather: WeatherSection | null;
  summary: string;
}

interface WeatherSection {
  location: string;
  date: string;
  riskLevel: string;
  precipitationMm: number | null;
  windKph: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
}

export async function buildDailyBrief(input: DailyBriefInput): Promise<DailyBriefResult> {
  const now = input.now ?? new Date();
  const today = startOfUtcDay(now);
  const in7 = new Date(today.getTime() + 7 * DAY_MS);
  const in14 = new Date(today.getTime() + 14 * DAY_MS);

  const client = getInsForgeAdminClient();
  const projectResult = await client.database
    .from("projects")
    .select("id, name, location")
    .eq("id", input.projectId)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projectResult.error || !projectResult.data) {
    return emptyBrief(input.projectId, "Obra no encontrada", now);
  }
  const project = projectResult.data as { name: string; location: string | null };
  const projectName = project.name;

  const [scheduleRes, hseRes, supplyRes, finRes, proactRes] = await Promise.all([
    client.database
      .from("project_schedule_tasks")
      .select("id, task_code, name, status, due_date, progress_pct")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .is("deleted_at", null)
      .in("status", ["not_started", "in_progress", "blocked"])
      .order("due_date", { ascending: true })
      .limit(200),

    client.database
      .from("project_hse_records")
      .select("id, subject_name, subcontractor_name, record_type, status, expires_at")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .is("deleted_at", null)
      .limit(200),

    client.database
      .from("project_supply_items")
      .select("id, item_name, status, required_by, required_quantity, received_quantity")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .is("deleted_at", null)
      .in("status", ["planned", "quoted", "ordered", "partial", "delayed"])
      .order("required_by", { ascending: true })
      .limit(200),

    client.database
      .from("project_financial_snapshots")
      .select("snapshot_date, planned_amount, actual_amount, committed_amount, currency")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .is("deleted_at", null)
      .order("snapshot_date", { ascending: false })
      .limit(1),

    client.database
      .from("operational_findings")
      .select("severity, title, last_detected_at")
      .eq("organization_id", input.organizationId)
      .eq("project_id", input.projectId)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("last_detected_at", { ascending: false })
      .limit(50),
  ]);

  if (scheduleRes.error) dbLogger.warn({ err: scheduleRes.error }, "daily-brief schedule query failed");
  if (hseRes.error)      dbLogger.warn({ err: hseRes.error },      "daily-brief hse query failed");
  if (supplyRes.error)   dbLogger.warn({ err: supplyRes.error },   "daily-brief supplies query failed");
  if (proactRes.error)   dbLogger.warn({ err: proactRes.error },   "daily-brief proactivity query failed");

  const schedule = scoreSchedule(scheduleRes.data as ScheduleRow[] | null, today, in7);
  const hse = scoreHse(hseRes.data as HseRow[] | null, today, in7);
  const supplies = scoreSupplies(supplyRes.data as SupplyRow[] | null, today, in14);
  const financial = scoreFinancial((finRes.data as FinancialRow[] | null)?.[0] ?? null);
  const alerts = scoreAlerts(proactRes.data as ProactivityRow[] | null);

  let weather: WeatherSection | null = null;
  if (input.includeWeather) {
    const weatherLocation = input.includeWeather.location ?? project.location ?? undefined;
    const hasCoordinates = input.includeWeather.latitude != null && input.includeWeather.longitude != null;
    if (!weatherLocation && !hasCoordinates) {
      weather = null;
    } else {
    try {
      const { evaluateWeatherImpact } = await import("@/lib/weather/open-meteo");
      const dateStr = isoDate(today);
      const result = await evaluateWeatherImpact({
        location: weatherLocation,
        latitude: input.includeWeather.latitude,
        longitude: input.includeWeather.longitude,
        startDate: dateStr,
        endDate: dateStr,
      });
      const firstDay = result.days[0];
      if (firstDay) {
        weather = {
          location: result.locationName,
          date: firstDay.date,
          riskLevel: firstDay.risk,
          precipitationMm: firstDay.precipitationMm,
          windKph: Math.round(Math.max(firstDay.windSpeedKmh, firstDay.windGustKmh)),
          tempMinC: firstDay.tempMinC,
          tempMaxC: firstDay.tempMaxC,
        };
      }
    } catch (err) {
      dbLogger.warn({ err }, "daily-brief weather lookup failed");
    }
    }
  }

  const summary = buildSummary({ projectName, schedule, hse, supplies, financial, alerts, weather });

  return {
    found: true,
    projectId: input.projectId,
    projectName,
    generatedAt: now.toISOString(),
    schedule,
    hse,
    supplies,
    financial,
    alerts,
    weather,
    summary,
  };
}

function scoreSchedule(rows: ScheduleRow[] | null, today: Date, in7: Date): DailyBriefResult["schedule"] {
  const items: DailyBriefResult["schedule"]["items"] = [];
  let overdue = 0;
  let dueToday = 0;
  let dueNext7Days = 0;
  let blocked = 0;

  for (const row of rows ?? []) {
    const dueDate = parseDate(row.due_date);
    let bucket: DailyBriefResult["schedule"]["items"][number]["bucket"];
    if (row.status === "blocked") { bucket = "blocked"; blocked++; }
    else if (dueDate && dueDate < today) { bucket = "overdue"; overdue++; }
    else if (dueDate && dueDate.getTime() === today.getTime()) { bucket = "due_today"; dueToday++; }
    else if (dueDate && dueDate <= in7) { bucket = "due_soon"; dueNext7Days++; }
    else continue;

    items.push({
      id: row.id,
      code: row.task_code,
      name: row.name,
      dueDate: row.due_date,
      status: row.status,
      progressPct: toNumber(row.progress_pct) ?? 0,
      bucket,
    });

    if (items.length >= 20) break;
  }

  return { overdue, dueToday, dueNext7Days, blocked, items };
}

function scoreHse(rows: HseRow[] | null, today: Date, in7: Date): DailyBriefResult["hse"] {
  const items: DailyBriefResult["hse"]["items"] = [];
  let expiringSoon = 0;
  let expired = 0;

  for (const row of rows ?? []) {
    const expires = parseDate(row.expires_at);
    const daysToExpire = expires ? Math.round((expires.getTime() - today.getTime()) / DAY_MS) : null;
    const isExpired = row.status === "expired" || (expires && expires < today);
    const isExpiringSoon = expires && expires >= today && expires <= in7;
    const isIncident = row.status === "incident" || row.status === "missing";

    if (!isExpired && !isExpiringSoon && !isIncident) continue;
    if (isExpired) expired++;
    else if (isExpiringSoon) expiringSoon++;

    items.push({
      id: row.id,
      subject: row.subject_name ?? row.subcontractor_name ?? "sin sujeto",
      recordType: row.record_type,
      expiresAt: row.expires_at,
      status: row.status,
      daysToExpire,
    });

    if (items.length >= 20) break;
  }

  return { expiringSoon, expired, items };
}

function scoreSupplies(rows: SupplyRow[] | null, today: Date, in14: Date): DailyBriefResult["supplies"] {
  const items: DailyBriefResult["supplies"]["items"] = [];
  let delayed = 0;
  let upcoming = 0;

  for (const row of rows ?? []) {
    const requiredBy = parseDate(row.required_by);
    const required = toNumber(row.required_quantity);
    const received = toNumber(row.received_quantity) ?? 0;
    const isDelayed = row.status === "delayed" || (requiredBy && requiredBy < today && row.status !== "received");
    const isUpcoming = requiredBy && requiredBy >= today && requiredBy <= in14 && row.status !== "received";
    if (!isDelayed && !isUpcoming) continue;

    if (isDelayed) delayed++;
    else if (isUpcoming) upcoming++;

    const receivedPct = required && required > 0 ? Math.round((received / required) * 100) : null;

    items.push({
      id: row.id,
      itemName: row.item_name,
      requiredBy: row.required_by,
      status: row.status,
      receivedPct,
    });

    if (items.length >= 20) break;
  }

  return { delayed, upcoming, items };
}

function scoreFinancial(row: FinancialRow | null): DailyBriefResult["financial"] {
  if (!row) {
    return { latestSnapshotDate: null, plannedAmount: null, actualAmount: null, committedAmount: null, deviationPct: null, currency: "ARS" };
  }
  const planned = toNumber(row.planned_amount);
  const actual = toNumber(row.actual_amount);
  const committed = toNumber(row.committed_amount);
  const reference = Math.max(actual ?? 0, committed ?? 0);
  const deviationPct = planned && planned > 0 && (actual != null || committed != null)
    ? Math.round(((reference - planned) / planned) * 10000) / 100
    : null;
  return {
    latestSnapshotDate: row.snapshot_date,
    plannedAmount: planned,
    actualAmount: actual,
    committedAmount: committed,
    deviationPct,
    currency: row.currency ?? "ARS",
  };
}

function scoreAlerts(rows: ProactivityRow[] | null): DailyBriefResult["alerts"] {
  const findings = rows ?? [];
  const top = findings
    .filter((finding) => finding.title)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 4)
    .map((finding) => finding.title);
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
    topTitles: top,
  };
}

function severityRank(severity: string): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function buildSummary(args: {
  projectName: string;
  schedule: DailyBriefResult["schedule"];
  hse: DailyBriefResult["hse"];
  supplies: DailyBriefResult["supplies"];
  financial: DailyBriefResult["financial"];
  alerts: DailyBriefResult["alerts"];
  weather: WeatherSection | null;
}): string {
  const parts: string[] = [`Brief diario · ${args.projectName}`];

  if (args.alerts.critical > 0) {
    parts.push(`${args.alerts.critical} alertas críticas activas`);
  }
  if (args.schedule.overdue > 0) parts.push(`${args.schedule.overdue} tarea(s) vencida(s)`);
  if (args.schedule.dueToday > 0) parts.push(`${args.schedule.dueToday} tarea(s) vencen hoy`);
  if (args.schedule.blocked > 0) parts.push(`${args.schedule.blocked} bloqueada(s)`);
  if (args.hse.expired > 0) parts.push(`${args.hse.expired} HSE vencido(s)`);
  if (args.hse.expiringSoon > 0) parts.push(`${args.hse.expiringSoon} HSE por vencer en 7d`);
  if (args.supplies.delayed > 0) parts.push(`${args.supplies.delayed} acopio(s) demorado(s)`);
  if (args.supplies.upcoming > 0) parts.push(`${args.supplies.upcoming} acopio(s) requeridos en 14d`);
  if (args.financial.deviationPct != null && Math.abs(args.financial.deviationPct) > 5) {
    parts.push(`desvío financiero ${args.financial.deviationPct}%`);
  }
  if (args.weather && args.weather.riskLevel !== "low") {
    parts.push(`clima ${args.weather.riskLevel} (${args.weather.location})`);
  }

  if (parts.length === 1) parts.push("sin alertas operativas para hoy");
  return parts.join(" · ");
}

function emptyBrief(projectId: string, message: string, now: Date): DailyBriefResult {
  return {
    found: false,
    projectId,
    projectName: message,
    generatedAt: now.toISOString(),
    schedule: { overdue: 0, dueToday: 0, dueNext7Days: 0, blocked: 0, items: [] },
    hse: { expiringSoon: 0, expired: 0, items: [] },
    supplies: { delayed: 0, upcoming: 0, items: [] },
    financial: { latestSnapshotDate: null, plannedAmount: null, actualAmount: null, committedAmount: null, deviationPct: null, currency: "ARS" },
    alerts: { critical: 0, warning: 0, info: 0, topTitles: [] },
    weather: null,
    summary: message,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
