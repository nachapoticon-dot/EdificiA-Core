import type { UIMessage } from "ai";

/**
 * Modos del turno: deciden qué módulos de prompt y qué tools ve el agente.
 *
 * "operations" está SIEMPRE activo — es la identidad (Project Manager Digital).
 * Los demás se activan por señal del turno (archivo adjunto o intención en el
 * texto reciente). Esto corrige estructuralmente el sesgo "todo es auditoría"
 * y reduce tokens por turno.
 */
export type TurnMode = "operations" | "documents" | "generation" | "communications";

export const ALL_MODES: TurnMode[] = ["operations", "documents", "generation", "communications"];

const DOCUMENT_INTENT =
  /audit|presupuesto|plano|documento|archivo|contrato|certificado|pliego|memoria descriptiva|c[oó]mputo|remito|factura|hallazgo|exclusion|contradic|versi[oó]n|comparar|cacheid|__file_meta__|dxf|excel|pdf|docx/i;

const GENERATION_INTENT =
  /gener[aá]|armam[eé]|arm[aá]me|orden de compra|informe|acta|parte diario|export[aá]|descargar|gr[aá]fic[ao]|chart|barras|torta|\bpie\b|memoria descriptiva/i;

const COMMUNICATION_INTENT =
  /\bemail\b|\bmail\b|correo|avis[aá]le|notific[aá]|envi[aá]le|mand[aá]le|escrib[ií]le|stakeholder/i;

export interface TurnSignals {
  recentText: string;
  hasFile: boolean;
}

/** Junta el texto de los últimos mensajes (ventana corta) para detectar intención sostenida. */
export function collectTurnSignals(messages: UIMessage[], windowSize = 6): TurnSignals {
  const recent = messages.slice(-windowSize);
  const recentText = recent
    .map((m) =>
      (m.parts ?? [])
        .map((p: { type?: string; text?: string }) => (p.type === "text" ? (p.text ?? "") : ""))
        .join(" "),
    )
    .join("\n");
  return { recentText, hasFile: recentText.includes("__file_meta__") || /cacheId/i.test(recentText) };
}

export function detectTurnModes(signals: TurnSignals): TurnMode[] {
  const modes: TurnMode[] = ["operations"];
  if (signals.hasFile || DOCUMENT_INTENT.test(signals.recentText)) modes.push("documents");
  if (GENERATION_INTENT.test(signals.recentText)) modes.push("generation");
  if (COMMUNICATION_INTENT.test(signals.recentText)) modes.push("communications");
  return modes;
}

/**
 * Tools visibles por modo. La unión de los grupos DEBE cubrir el catálogo
 * completo de createBoundTools (verificado por test): una tool fuera de todo
 * grupo sería invisible para el agente.
 */
export const TOOL_GROUPS: Record<TurnMode, string[]> = {
  operations: [
    "analizar_estado_obra",
    "resumen_diario_obra",
    "evaluar_impacto_clima",
    "verificar_ingreso_personal",
    "reprogramar_e_informar",
    "auditar_curva_inversion",
    "auditar_subcontratos",
    "registrar_acopio",
    "registrar_hse_record",
    "registrar_snapshot_financiero",
    "registrar_subcontrato",
    "buscar_en_base_documental",
    "consultar_perfil_empresa",
    "recuperar_sesion_anterior",
    "recordar_aprendizaje",
    "proponer_cierre_expediente",
    "proyectar_metricas",
    "proyectar_cronograma",
    "proyectar_comparativa",
    "proyectar_legajo_grafico",
    "generar_grafica",
  ],
  documents: [
    "calcular_totales",
    "validar_cierre_de_total",
    "detectar_exclusiones_logicas",
    "calcular_incidencia_de_subgrupo",
    "comparar_con_indices",
    "comparar_presupuestos",
    "comparar_computo_con_plano",
    "analizar_geometria_plano",
    "reportar_hallazgo",
    "reportar_hallazgos_batch",
    "buscar_relaciones_documento",
    "resolver_relacion_documental",
    "sugerir_formato",
  ],
  generation: [
    "generar_presupuesto_excel",
    "generar_memoria_descriptiva",
    "generar_informe_pdf",
    "generar_orden_compra",
    "generar_acta_obra",
    "generar_archivo",
  ],
  communications: ["enviar_email_stakeholder"],
};

export function toolNamesForModes(modes: TurnMode[]): Set<string> {
  const names = new Set<string>();
  for (const mode of modes) {
    for (const name of TOOL_GROUPS[mode]) names.add(name);
  }
  return names;
}

/** Filtra un record de tools dejando solo las visibles para los modos activos. */
export function filterToolsByModes<T extends Record<string, unknown>>(tools: T, modes: TurnMode[]): T {
  const allowed = toolNamesForModes(modes);
  const filtered: Record<string, unknown> = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (allowed.has(name)) filtered[name] = tool;
  }
  return filtered as T;
}
