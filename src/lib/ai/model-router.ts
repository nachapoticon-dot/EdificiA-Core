import type { UIMessage } from "ai";
import { AI_MODEL } from "./agent-prompt";

export type ModelTier = "fast" | "deep";

export interface ModelRouteDecision {
  tier: ModelTier;
  model: string;
  reason: string;
  signals: {
    hasFileAttachment: boolean;
    hasCrossDocIntent: boolean;
    hasContradictionIntent: boolean;
    hasAvsBCompare: boolean;
    longTurn: boolean;
    deepHinted: boolean;
  };
}

/**
 * DeepSeek V4 Flash baseline. Override DEEP via env var when an "advanced"
 * model is available (Claude Sonnet via @ai-sdk/anthropic, DeepSeek Reasoner,
 * GPT-4 mini, etc.). Until then DEEP falls back to FAST and the routing
 * still records intent so future swaps are zero-cost.
 */
const FAST_MODEL = process.env.AI_MODEL_FAST ?? AI_MODEL;
const DEEP_MODEL = process.env.AI_MODEL_DEEP ?? FAST_MODEL;

const CROSS_DOC_KEYWORDS = [
  "cruzar", "cruz ", "cruza ",
  "varios documentos", "múltiples documentos", "multiples documentos",
  "todos los documentos", "varias versiones", "varias obras",
  "transversal", "consolidado", "consolidad",
];

const CONTRADICTION_KEYWORDS = [
  "contradicci", "contradict", "inconsistenci", "incongruenc",
  "discrepanci", "no coincide", "no coinciden", "no cierra", "no cuadra",
];

const A_VS_B_PATTERN = /\bA\s*(vs|versus|contra|frente a)\s*B\b/i;

const DEEP_HINT_KEYWORDS = [
  "razonamiento profundo", "modelo profundo", "modelo avanzado",
  "analizar a fondo", "auditoría profunda", "auditoria profunda",
  "auditar a fondo",
];

const LONG_TURN_THRESHOLD_CHARS = 8000;

function textFromMessage(message: UIMessage): string {
  const parts = message.parts ?? [];
  return parts
    .map((part: { type?: string; text?: string }) => (part.type === "text" ? part.text ?? "" : ""))
    .join(" ");
}

export function routeModel(messages: UIMessage[]): ModelRouteDecision {
  const last = messages[messages.length - 1];
  const lastText = last ? textFromMessage(last) : "";
  const lower = lastText.toLowerCase();

  const hasFileAttachment = /__file_meta__/.test(lastText);
  const hasCrossDocIntent = CROSS_DOC_KEYWORDS.some((kw) => lower.includes(kw));
  const hasContradictionIntent = CONTRADICTION_KEYWORDS.some((kw) => lower.includes(kw));
  const hasAvsBCompare = A_VS_B_PATTERN.test(lastText) || lower.includes("comparar_presupuestos");
  const longTurn = lastText.length > LONG_TURN_THRESHOLD_CHARS;
  const deepHinted = DEEP_HINT_KEYWORDS.some((kw) => lower.includes(kw));

  const signals = {
    hasFileAttachment,
    hasCrossDocIntent,
    hasContradictionIntent,
    hasAvsBCompare,
    longTurn,
    deepHinted,
  };

  let score = 0;
  const reasons: string[] = [];

  if (hasAvsBCompare) {
    score += 3;
    reasons.push("comparativa A vs B");
  }
  if (hasContradictionIntent) {
    score += 2;
    reasons.push("intención de contradicción");
  }
  if (hasCrossDocIntent) {
    score += 2;
    reasons.push("cross-doc explícito");
  }
  if (deepHinted) {
    score += 2;
    reasons.push("usuario pidió razonamiento profundo");
  }
  if (longTurn) {
    score += 1;
    reasons.push("turno > 8k caracteres");
  }
  if (hasFileAttachment) {
    score += 1;
    reasons.push("archivo adjunto");
  }

  const tier: ModelTier = score >= 3 ? "deep" : "fast";
  const model = tier === "deep" ? DEEP_MODEL : FAST_MODEL;
  const reason = reasons.length > 0 ? reasons.join(", ") : "baseline (chitchat / tarea simple)";

  return { tier, model, reason, signals };
}
