export interface HypothesisBranch {
  name: string;
  confidence: number;
  evidence: string;
}

export interface HypothesisSpec {
  branches: HypothesisBranch[];
  chosen?: string;
  rationale?: string;
}

export interface HypothesisExtractResult {
  hypothesis: HypothesisSpec | null;
  cleanText: string;
  /** True while `<hypothesis>` is open but `</hypothesis>` hasn't arrived (streaming). */
  pending: boolean;
}

const HYP_RE = /<hypothesis>\s*(\{[\s\S]*?\})\s*<\/hypothesis>/;
const HYP_OPEN = "<hypothesis>";
const HYP_CLOSE = "</hypothesis>";

function isValidSpec(value: unknown): value is HypothesisSpec {
  if (!value || typeof value !== "object") return false;
  const obj = value as { branches?: unknown };
  if (!Array.isArray(obj.branches) || obj.branches.length === 0) return false;
  return obj.branches.every((b) => {
    if (!b || typeof b !== "object") return false;
    const branch = b as { name?: unknown; confidence?: unknown; evidence?: unknown };
    return typeof branch.name === "string" && typeof branch.confidence === "number" && typeof branch.evidence === "string";
  });
}

/**
 * Extracts the first `<hypothesis>{...}</hypothesis>` block from an assistant
 * text. Handles partial streaming: if the open tag is present without close,
 * the raw JSON-in-progress is hidden and `pending` is set to true.
 */
export function extractHypothesis(text: string): HypothesisExtractResult {
  const match = text.match(HYP_RE);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]!);
      if (isValidSpec(parsed)) {
        const cleanText = text.replace(match[0], "").replace(/^\s*\n+/, "").trimEnd();
        return { hypothesis: parsed, cleanText, pending: false };
      }
    } catch {
      /* fall through to plain text */
    }
  }
  const openIdx = text.indexOf(HYP_OPEN);
  if (openIdx !== -1 && !text.includes(HYP_CLOSE)) {
    return { hypothesis: null, cleanText: text.slice(0, openIdx).trimEnd(), pending: true };
  }
  return { hypothesis: null, cleanText: text, pending: false };
}
