import type { BlockSpec } from "@/lib/validators/blocks";

// ─────────────────────────────────────────────────────────────────────────────
// Datos de demo — Las Lomas / Torre A.
// Útil para seedear tests, Storybook, y la página de demostración.
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_METRICS: BlockSpec = {
  kind: "metrics",
  title: "Incidencia por rubro — Torre A · Las Lomas",
  kpis: [
    { label: "TOTAL OBRA",     value: "$128.45M", delta: 2.4, sub: "vs presupuesto base" },
    { label: "AVANCE FÍSICO",  value: "34.2%",    delta: 5.1, sub: "abril 2026" },
    { label: "DESVÍO vs CAC",  value: "+6.8%",    delta: 6.8, alert: true, sub: "índice abril" },
    { label: "M² CONSTRUIDOS", value: "8 420",    delta: 12,  sub: "de 24 580 totales" },
  ],
  bars: [
    { label: "Estructura H°A°",      value: 49_316_000, pct: 38.4 },
    { label: "Mampostería",          value: 18_240_000, pct: 14.2 },
    { label: "Inst. sanitarias",     value: 16_980_000, pct: 13.2, alert: true },
    { label: "Inst. eléctricas",     value: 12_815_000, pct: 9.9 },
    { label: "Terminaciones",        value: 11_340_000, pct: 8.8 },
    { label: "Movimiento de suelos", value:  9_120_000, pct: 7.1 },
    { label: "Carpinterías",         value:  6_580_000, pct: 5.1 },
    { label: "Cubierta",             value:  4_059_000, pct: 3.2 },
  ],
  totalLabel: "TOTAL",
  footer: "fuente · presupuesto R3 · contraste contra CAC abril/2026",
};

export const DEMO_MEDIA: BlockSpec = {
  kind: "media",
  title: "Legajo gráfico — Las Lomas / Torre A",
  obra: "OBRA-2024-LL01",
  synced: "hace 4m",
  items: [
    { kind: "plano",  title: "Arquitectura · planta tipo (R7)", date: "06/05/2026", location: "Niveles +3 a +12", ext: "DXF · 4.2 MB", seed: 2 },
    { kind: "render", title: "Fachada norte",                   date: "02/05/2026", location: "Vista exterior",   ext: "PNG · 3840×2160", seed: 3 },
    { kind: "obra",   title: "Subsuelo — armado de tabiques",   date: "09/05/2026", location: "Nivel −2",         ext: "JPG · 12 fotos", seed: 1 },
    { kind: "plano",  title: "Estructura · planilla columnas",  date: "28/04/2026", location: "Niveles −2 a +14", ext: "PDF · 1.8 MB", seed: 4 },
  ],
};

export const DEMO_COMPARISON: BlockSpec = {
  kind: "comparison",
  title: "Hormigón elaborado H21 · 220 m³",
  rankBy: "score técnico-comercial",
  cols: [
    { key: "precio", label: "PRECIO m³",  format: "currency",     alertThreshold: 95_000 },
    { key: "plazo",  label: "ENTREGA",    format: "duration_h" },
    { key: "iram",   label: "IRAM 1666",  format: "boolean_iram" },
    { key: "obras",  label: "OBRAS PREV.", format: "count_obras" },
  ],
  items: [
    { name: "Hormigonera del Sur",  sub: "Avellaneda · entrega flota propia",  score: 92, values: { precio: 87_400, plazo: 24, iram: true, obras: 18 } },
    { name: "Concretos Pampa",      sub: "San Martín · mixers tercerizados",   score: 81, values: { precio: 89_900, plazo: 36, iram: true, obras: 12 } },
    { name: "Hormigón Express",     sub: "Tigre · obras < 300 m³",             score: 64, values: { precio: 91_200, plazo: 48, iram: true, obras: 5 } },
    { name: "Materiales La Plata",  sub: "La Plata · sin entrega CABA fines",  score: 51, values: { precio: 96_800, plazo: 72, iram: false, obras: 9 } },
  ],
};

export const DEMO_TIMELINE: BlockSpec = {
  kind: "timeline",
  title: "Cronograma de avance — Las Lomas / Torre A",
  totalDays: 220,
  todayDay: 132,
  months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul"],
  phases: [
    { name: "Movimiento de suelos", crew: "Suelos S.A.",         start: 0,   end: 28  },
    { name: "Estructura H°A°",      crew: "Estr. Constructora",  start: 24,  end: 110 },
    { name: "Mampostería",          crew: "Equipo propio",       start: 96,  end: 158 },
    { name: "Inst. sanitarias",     crew: "Plomería Norte",      start: 128, end: 178 },
    { name: "Inst. eléctricas",     crew: "Edisur",              start: 138, end: 184 },
    { name: "Terminaciones",        crew: "Equipo propio",       start: 170, end: 215 },
    { name: "Limpieza + entrega",   crew: "Cuadrilla final",     start: 210, end: 220 },
  ],
  milestones: [
    { label: "Certif. intermedia 60%", day: 146, note: "Comitente · viernes 23/05" },
    { label: "Cierre de losas",        day: 110, note: "completado 04/05" },
    { label: "Recepción provisoria",   day: 220, note: "septiembre 2026" },
  ],
};
