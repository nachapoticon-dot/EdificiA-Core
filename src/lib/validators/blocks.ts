import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// EdificIA — Bloques de Respuesta · Zod schemas (E2E)
//
// Validan tanto la salida de las AI tools (server) como el render defensivo
// en MessageBubble (client). Shape único discriminado por `kind`.
// ─────────────────────────────────────────────────────────────────────────────

// ── Metrics ──────────────────────────────────────────────────────────────────
export const KpiSchema = z.object({
  label: z.string(),                        // "TOTAL OBRA"
  value: z.string(),                        // ya formateado AR-style
  delta: z.number().optional(),             // % con signo
  alert: z.boolean().optional(),            // resalta en --warn
  sub: z.string().optional(),               // "vs presupuesto base"
  confidence: z.number().min(0).max(100).optional(),
});

export const BarSchema = z.object({
  label: z.string(),
  value: z.number(),                        // en $ AR
  pct: z.number().optional(),
  alert: z.boolean().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export const MetricsSpec = z.object({
  kind: z.literal("metrics"),
  title: z.string(),
  kpis: z.array(KpiSchema).min(2).max(4),
  bars: z.array(BarSchema).min(1).max(12),
  totalLabel: z.string().default("Σ"),
  footer: z.string().optional(),
});
export type MetricsSpec = z.infer<typeof MetricsSpec>;

// ── Media ────────────────────────────────────────────────────────────────────
export const MediaItem = z.object({
  kind: z.enum(["plano", "render", "obra"]),
  title: z.string(),
  date: z.string().optional(),              // DD/MM/YYYY ya formateada
  location: z.string().optional(),
  ext: z.string().optional(),               // "DXF · 4.2 MB"
  documentId: z.string().optional(),        // FK a documents.id
  thumbnailUrl: z.string().url().optional(),// presigned InsForge URL
  seed: z.number().int().optional(),        // para SVG fallback determinístico
});
export type MediaItem = z.infer<typeof MediaItem>;

export const MediaSpec = z.object({
  kind: z.literal("media"),
  title: z.string(),
  obra: z.string(),                         // código de obra
  synced: z.string().optional(),
  items: z.array(MediaItem).min(1).max(8),
});
export type MediaSpec = z.infer<typeof MediaSpec>;

// ── Comparison ───────────────────────────────────────────────────────────────
export const CompCol = z.object({
  key: z.string(),
  label: z.string(),
  format: z.enum(["currency", "duration_h", "boolean_iram", "count_obras", "raw"]),
  alertThreshold: z.number().optional(),
});
export type CompCol = z.infer<typeof CompCol>;

export const CompItem = z.object({
  name: z.string(),
  sub: z.string().optional(),
  score: z.number().min(0).max(100),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type CompItem = z.infer<typeof CompItem>;

export const ComparisonSpec = z.object({
  kind: z.literal("comparison"),
  title: z.string(),
  rankBy: z.string(),
  cols: z.array(CompCol).min(2).max(6),
  items: z.array(CompItem).min(2).max(8),
});
export type ComparisonSpec = z.infer<typeof ComparisonSpec>;

// ── Timeline (Gantt) ─────────────────────────────────────────────────────────
export const TimelinePhase = z.object({
  name: z.string(),
  crew: z.string().optional(),
  start: z.number().int().nonnegative(),    // día desde inicio
  end: z.number().int().positive(),
});
export type TimelinePhase = z.infer<typeof TimelinePhase>;

export const TimelineMilestone = z.object({
  label: z.string(),
  day: z.number().int().nonnegative(),
  note: z.string().optional(),
});
export type TimelineMilestone = z.infer<typeof TimelineMilestone>;

export const TimelineSpec = z.object({
  kind: z.literal("timeline"),
  title: z.string(),
  totalDays: z.number().int().positive(),
  todayDay: z.number().int().nonnegative(),
  months: z.array(z.string()).min(2).max(12),
  phases: z.array(TimelinePhase).min(1).max(20),
  milestones: z.array(TimelineMilestone).max(10).default([]),
});
export type TimelineSpec = z.infer<typeof TimelineSpec>;

// ── Union ────────────────────────────────────────────────────────────────────
export const BlockSpec = z.discriminatedUnion("kind", [
  MetricsSpec,
  MediaSpec,
  ComparisonSpec,
  TimelineSpec,
]);
export type BlockSpec = z.infer<typeof BlockSpec>;
export type BlockKind = BlockSpec["kind"];
