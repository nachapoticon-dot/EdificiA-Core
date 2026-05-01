/** Complete construction phase knowledge base for Argentine residential/commercial projects. */

export type DocType = "plano" | "computo" | "presupuesto" | "memoria" | "remito";

export interface ExpectedDoc {
  doc_type: DocType;
  label: string;
  required: boolean;
}

export interface ObraPhase {
  key: string;
  name: string;
  order: number;
  expected: ExpectedDoc[];
}

export const OBRA_PHASES: ObraPhase[] = [
  {
    key: "proyecto",
    name: "Proyecto General",
    order: 1,
    expected: [
      { doc_type: "plano",    label: "Planos generales (planta, corte, fachada)", required: true },
      { doc_type: "memoria",  label: "Memoria descriptiva",                       required: false },
    ],
  },
  {
    key: "fundaciones",
    name: "Fundaciones",
    order: 2,
    expected: [
      { doc_type: "plano",       label: "Plano de fundaciones",        required: true },
      { doc_type: "computo",     label: "Cómputo de fundaciones",       required: true },
      { doc_type: "presupuesto", label: "Presupuesto de fundaciones",   required: false },
    ],
  },
  {
    key: "estructura",
    name: "Estructura",
    order: 3,
    expected: [
      { doc_type: "plano",       label: "Plano estructural",          required: true },
      { doc_type: "computo",     label: "Cómputo de estructura",       required: true },
      { doc_type: "presupuesto", label: "Presupuesto de estructura",   required: false },
    ],
  },
  {
    key: "albanileria",
    name: "Albañilería",
    order: 4,
    expected: [
      { doc_type: "plano",       label: "Plano de albañilería / yeso", required: true },
      { doc_type: "computo",     label: "Cómputo de albañilería",      required: true },
      { doc_type: "presupuesto", label: "Presupuesto de albañilería",  required: false },
    ],
  },
  {
    key: "cubierta",
    name: "Cubierta",
    order: 5,
    expected: [
      { doc_type: "plano",       label: "Plano de cubierta",           required: true },
      { doc_type: "computo",     label: "Cómputo de cubierta",         required: true },
    ],
  },
  {
    key: "sanitaria",
    name: "Inst. Sanitaria",
    order: 6,
    expected: [
      { doc_type: "plano",       label: "Plano sanitario",             required: true },
      { doc_type: "computo",     label: "Cómputo sanitario",           required: true },
    ],
  },
  {
    key: "electrica",
    name: "Inst. Eléctrica",
    order: 7,
    expected: [
      { doc_type: "plano",       label: "Plano eléctrico",             required: true },
      { doc_type: "computo",     label: "Cómputo eléctrico",           required: true },
    ],
  },
  {
    key: "terminaciones",
    name: "Terminaciones",
    order: 8,
    expected: [
      { doc_type: "computo",     label: "Cómputo de terminaciones",    required: true },
      { doc_type: "presupuesto", label: "Presupuesto de terminaciones",required: false },
    ],
  },
  {
    key: "presupuesto_general",
    name: "Presupuesto General",
    order: 9,
    expected: [
      { doc_type: "presupuesto", label: "Presupuesto ejecutivo global", required: true },
    ],
  },
];

// ── Keyword classifier ────────────────────────────────────────

const PHASE_KEYWORDS: { key: string; words: string[] }[] = [
  { key: "fundaciones",        words: ["fundacion", "fundaciones", "cimiento", "cimientos", "zapata", "pilote", "excavacion"] },
  { key: "estructura",         words: ["estructura", "estructural", "columna", "viga", "losa", "hormigon", "armado", "reticulado"] },
  { key: "albanileria",        words: ["albanileria", "albañileria", "mampuesto", "ladrillo", "yeso", "revoque", "mamposteria", "tabique"] },
  { key: "cubierta",           words: ["cubierta", "techo", "membrana", "impermeabilizacion", "azotea", "aislacion"] },
  { key: "sanitaria",          words: ["sanitaria", "sanitario", "plomeria", "agua", "cloaca", "desague", "pluvial", "cloacas"] },
  { key: "electrica",          words: ["electrica", "electrico", "electricidad", "tablero", "cableado", "tension", "luminaria", "iluminacion"] },
  { key: "terminaciones",      words: ["terminacion", "terminaciones", "pintura", "ceramica", "piso", "revestimiento", "solado", "cielorraso", "zocalo", "carpinteria"] },
  { key: "proyecto",           words: ["proyecto", "general", "memoria", "descriptiva", "planta", "corte", "fachada", "arquitectura"] },
  { key: "presupuesto_general",words: ["presupuesto", "budget", "ejecutivo", "global", "total"] },
];

/** Normalizes text to ASCII lowercase for keyword matching. */
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Classifies an uploaded file into an obra phase based on filename and content.
 * Returns the phase key, or null if no confident match.
 */
export function detectPhaseKey(fileName: string, contentHint?: string): string | null {
  const text = normalize(fileName + " " + (contentHint ?? ""));
  for (const { key, words } of PHASE_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return key;
  }
  return null;
}

/**
 * Maps a processed file type to a document type for the phase coverage table.
 * Excel with prices → presupuesto; Excel without → computo; DXF → plano; PDF/DOCX → memoria.
 */
export function detectDocType(
  fileType: string,
  hasPrices?: boolean,
): DocType {
  if (fileType === "dxf")                       return "plano";
  if (fileType === "excel" && hasPrices)        return "presupuesto";
  if (fileType === "excel")                     return "computo";
  if (fileType === "pdf" || fileType === "docx") return "memoria";
  return "memoria";
}
