/**
 * Detector de PII (Información Personal Identificable) para documentos de obra
 * en contexto argentino. Conservador por diseño: prefiere falso negativo a
 * falso positivo, porque cada match termina como un warning al admin.
 *
 * Detecta:
 *   - CUIT/CUIL (con verificación de checksum módulo 11)
 *   - DNI (requiere contexto léxico cercano: "DNI", "documento", etc.)
 *   - CBU (22 dígitos + checksum por bloques)
 *   - Email
 *   - Teléfono móvil argentino
 */

export type PiiType = "cuit" | "dni" | "cbu" | "email" | "phone";

export interface PiiMatch {
  type: PiiType;
  count: number;
  /** Hasta 3 muestras anonimizadas (primeros y últimos dígitos visibles). */
  samples: string[];
}

export interface PiiScanResult {
  hasMatches: boolean;
  totalCount: number;
  matches: PiiMatch[];
}

const EMPTY: PiiScanResult = { hasMatches: false, totalCount: 0, matches: [] };

const LABELS: Record<PiiType, string> = {
  cuit: "CUIT / CUIL",
  dni:  "DNI",
  cbu:  "CBU",
  email: "Email",
  phone: "Teléfono móvil",
};

export function piiLabel(type: PiiType): string {
  return LABELS[type];
}

export function scanForPii(text: string): PiiScanResult {
  if (!text || text.length < 8) return EMPTY;

  const matches: Record<PiiType, Set<string>> = {
    cuit:  new Set(),
    dni:   new Set(),
    cbu:   new Set(),
    email: new Set(),
    phone: new Set(),
  };

  // ── CUIT / CUIL ─────────────────────────────────────────────────────────
  // Acepta XX-XXXXXXXX-X o 11 dígitos seguidos; valida checksum.
  const CUIT_RE = /\b(\d{2})[-\s]?(\d{8})[-\s]?(\d)\b/g;
  for (const m of text.matchAll(CUIT_RE)) {
    const digits = `${m[1]}${m[2]}${m[3]}`;
    if (isValidCuit(digits)) matches.cuit.add(digits);
  }

  // ── DNI ─────────────────────────────────────────────────────────────────
  // 7-8 dígitos, opcionalmente con puntos. Requiere contexto léxico para
  // evitar falsos positivos sobre montos, códigos de ítem, etc.
  const DNI_RE = /\b(?:DNI|D\.N\.I\.?|documento(?:\s+nacional)?(?:\s+de\s+identidad)?)\s*(?:N[º°o]?\.?\s*)?[:#]?\s*(\d{1,2}[.\s]?\d{3}[.\s]?\d{3}|\d{7,8})\b/gi;
  for (const m of text.matchAll(DNI_RE)) {
    const digits = m[1]!.replace(/[^\d]/g, "");
    if (digits.length >= 7 && digits.length <= 8) matches.dni.add(digits);
  }

  // ── CBU ─────────────────────────────────────────────────────────────────
  // 22 dígitos consecutivos. Validar checksum (2 bloques de 11).
  const CBU_RE = /\b\d{22}\b/g;
  for (const m of text.matchAll(CBU_RE)) {
    if (isValidCbu(m[0])) matches.cbu.add(m[0]);
  }

  // ── Email ───────────────────────────────────────────────────────────────
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  for (const m of text.matchAll(EMAIL_RE)) {
    matches.email.add(m[0].toLowerCase());
  }

  // ── Teléfono móvil AR ───────────────────────────────────────────────────
  // +54 9 11 XXXX-XXXX, 011 15-XXXX-XXXX, etc. Requiere contexto numérico
  // con suficiente longitud y separadores típicos.
  const PHONE_RE = /(?:\+?54\s?9?\s?|0)(?:11|2\d{2}|3\d{2})[\s-]?\d{4}[\s-]?\d{4}\b/g;
  for (const m of text.matchAll(PHONE_RE)) {
    const normalized = m[0].replace(/[\s-]/g, "");
    if (normalized.length >= 10) matches.phone.add(normalized);
  }

  return buildResult(matches);
}

function buildResult(matches: Record<PiiType, Set<string>>): PiiScanResult {
  const out: PiiMatch[] = [];
  let total = 0;
  for (const [type, set] of Object.entries(matches) as [PiiType, Set<string>][]) {
    if (set.size === 0) continue;
    total += set.size;
    out.push({
      type,
      count: set.size,
      samples: Array.from(set).slice(0, 3).map((v) => anonymize(type, v)),
    });
  }
  return { hasMatches: out.length > 0, totalCount: total, matches: out };
}

function anonymize(type: PiiType, value: string): string {
  switch (type) {
    case "cuit": {
      // 20-12345678-9 → 20-•••••678-9
      const head = value.slice(0, 2);
      const tail3 = value.slice(7, 10);
      const last = value.slice(10);
      return `${head}-•••••${tail3}-${last}`;
    }
    case "dni": {
      // 12345678 → •••••678
      return `•••••${value.slice(-3)}`;
    }
    case "cbu": {
      // mostrar primeros 4 y últimos 4
      return `${value.slice(0, 4)}••••••••••••••${value.slice(-4)}`;
    }
    case "email": {
      const [local, domain] = value.split("@");
      if (!local || !domain) return "•••@•••";
      const visible = local.length <= 2 ? local : `${local[0]}${"•".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}`;
      return `${visible}@${domain}`;
    }
    case "phone": {
      return `${value.slice(0, 3)}•••${value.slice(-3)}`;
    }
  }
}

// ── CUIT checksum (módulo 11) ────────────────────────────────────────────
function isValidCuit(d: string): boolean {
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * weights[i]!;
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(d[10]);
}

// ── CBU checksum (bloques de 8+14 con dígitos verificadores en pos 8 y 22) ─
function isValidCbu(d: string): boolean {
  if (d.length !== 22) return false;
  const checkBlock = (block: string, weights: number[]): boolean => {
    const body = block.slice(0, -1);
    const check = Number(block.slice(-1));
    let sum = 0;
    for (let i = 0; i < body.length; i++) sum += Number(body[i]) * weights[i]!;
    const calc = (10 - (sum % 10)) % 10;
    return calc === check;
  };
  // Block 1: 8 dígitos, pesos 7,1,3,9,7,1,3,9 (entidad+sucursal+dv)
  // Block 2: 14 dígitos, pesos 3,9,7,1,3,9,7,1,3,9,7,1,3,9 (cuenta+dv)
  return (
    checkBlock(d.slice(0, 8),  [7, 1, 3, 9, 7, 1, 3]) &&
    checkBlock(d.slice(8, 22), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])
  );
}
