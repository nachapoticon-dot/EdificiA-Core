import type { ProjectScheduleTaskStatus } from "@/types";

const VALID_STATUS = new Set<ProjectScheduleTaskStatus>([
  "not_started", "in_progress", "blocked", "done", "cancelled",
]);

const COLUMN_ALIASES: Record<string, string> = {
  // canonical: code, name, description, status, start_date, due_date, progress_pct, predecessor_code
  "código":            "task_code",
  "codigo":            "task_code",
  "code":              "task_code",
  "task_code":         "task_code",
  "tarea":             "name",
  "nombre":            "name",
  "name":              "name",
  "descripción":       "description",
  "descripcion":       "description",
  "description":       "description",
  "estado":            "status",
  "status":            "status",
  "inicio":            "start_date",
  "fecha_inicio":      "start_date",
  "start":             "start_date",
  "start_date":        "start_date",
  "fin":               "due_date",
  "vencimiento":       "due_date",
  "fecha_fin":         "due_date",
  "due":               "due_date",
  "due_date":          "due_date",
  "avance":            "progress_pct",
  "avance_pct":        "progress_pct",
  "progress":          "progress_pct",
  "progress_pct":      "progress_pct",
  "predecesor":        "predecessor_code",
  "predecessor":       "predecessor_code",
  "predecessor_code":  "predecessor_code",
};

const STATUS_ALIASES: Record<string, ProjectScheduleTaskStatus> = {
  "no_iniciada":    "not_started",
  "no iniciada":    "not_started",
  "pendiente":      "not_started",
  "not_started":    "not_started",
  "en_progreso":    "in_progress",
  "en progreso":    "in_progress",
  "en_curso":       "in_progress",
  "en curso":       "in_progress",
  "in_progress":    "in_progress",
  "bloqueada":      "blocked",
  "bloqueado":      "blocked",
  "blocked":        "blocked",
  "completada":     "done",
  "completado":     "done",
  "terminada":      "done",
  "done":           "done",
  "cancelada":      "cancelled",
  "cancelado":      "cancelled",
  "cancelled":      "cancelled",
};

export interface ParsedScheduleRow {
  rowNumber: number;
  task_code: string | null;
  name: string;
  description: string | null;
  status: ProjectScheduleTaskStatus;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number;
  predecessor_code: string | null;
}

export interface CsvImportResult {
  rows: ParsedScheduleRow[];
  warnings: string[];
  errors: string[];
}

export function parseScheduleCsv(text: string): CsvImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const records = tokenizeCsv(text);
  if (records.length === 0) {
    return { rows: [], warnings, errors: ["El archivo está vacío."] };
  }

  const headerRow = records[0]!;
  const headers = headerRow.map((cell) => cell.trim().toLowerCase());
  const columnIndex = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    const canonical = COLUMN_ALIASES[headers[i]!];
    if (canonical && !columnIndex.has(canonical)) columnIndex.set(canonical, i);
  }

  if (!columnIndex.has("name")) {
    errors.push("Falta columna obligatoria 'name' (o 'nombre', 'tarea').");
    return { rows: [], warnings, errors };
  }

  const rows: ParsedScheduleRow[] = [];
  const seenCodes = new Set<string>();

  for (let r = 1; r < records.length; r++) {
    const record = records[r]!;
    if (record.every((cell) => cell.trim() === "")) continue;
    const rowNumber = r + 1;

    const name = (record[columnIndex.get("name")!] ?? "").trim();
    if (!name) {
      errors.push(`Fila ${rowNumber}: la columna 'name' está vacía.`);
      continue;
    }

    const rawCode = readCell(record, columnIndex, "task_code");
    const task_code = rawCode ? rawCode.trim() : null;
    if (task_code) {
      if (seenCodes.has(task_code)) {
        warnings.push(`Fila ${rowNumber}: código "${task_code}" duplicado dentro del CSV.`);
      } else {
        seenCodes.add(task_code);
      }
    }

    const statusRaw = (readCell(record, columnIndex, "status") ?? "").trim().toLowerCase();
    let status: ProjectScheduleTaskStatus = "not_started";
    if (statusRaw) {
      const mapped = STATUS_ALIASES[statusRaw];
      if (mapped) status = mapped;
      else if (VALID_STATUS.has(statusRaw as ProjectScheduleTaskStatus)) status = statusRaw as ProjectScheduleTaskStatus;
      else warnings.push(`Fila ${rowNumber}: estado "${statusRaw}" no reconocido. Se asume 'not_started'.`);
    }

    const start_date = normalizeDate(readCell(record, columnIndex, "start_date"), rowNumber, warnings, "start_date");
    const due_date   = normalizeDate(readCell(record, columnIndex, "due_date"),   rowNumber, warnings, "due_date");

    if (start_date && due_date && start_date > due_date) {
      warnings.push(`Fila ${rowNumber}: start_date posterior a due_date.`);
    }

    const progressRaw = readCell(record, columnIndex, "progress_pct");
    let progress_pct = 0;
    if (progressRaw && progressRaw.trim() !== "") {
      const numeric = parseProgress(progressRaw);
      if (numeric == null) {
        warnings.push(`Fila ${rowNumber}: progress_pct "${progressRaw}" inválido. Se asume 0.`);
      } else {
        progress_pct = numeric;
      }
    }
    if (status === "done" && progress_pct < 100) progress_pct = 100;

    const description = readCell(record, columnIndex, "description")?.trim() || null;
    const predecessor_code = readCell(record, columnIndex, "predecessor_code")?.trim() || null;

    rows.push({
      rowNumber,
      task_code,
      name,
      description,
      status,
      start_date,
      due_date,
      progress_pct,
      predecessor_code,
    });
  }

  return { rows, warnings, errors };
}

function readCell(record: string[], index: Map<string, number>, key: string): string | undefined {
  const i = index.get(key);
  if (i == null) return undefined;
  return record[i];
}

function normalizeDate(value: string | undefined, rowNumber: number, warnings: string[], fieldLabel: string): string | null {
  if (!value || !value.trim()) return null;
  const raw = value.trim();

  // ISO YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY o DD-MM-YYYY
  const arMatch = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2}|\d{4})$/);
  if (arMatch) {
    const [, dStr, mStr, yStr] = arMatch;
    const day = Number(dStr);
    const month = Number(mStr);
    let year = Number(yStr);
    if (yStr!.length === 2) year = 2000 + year;
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      warnings.push(`Fila ${rowNumber}: ${fieldLabel} "${raw}" tiene día/mes fuera de rango.`);
      return null;
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  warnings.push(`Fila ${rowNumber}: ${fieldLabel} "${raw}" no respeta formato YYYY-MM-DD ni DD/MM/YYYY.`);
  return null;
}

function parseProgress(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Minimal RFC4180-ish CSV tokenizer. Handles quoted fields, embedded
 * quotes (""), commas and newlines. Accepts \r\n or \n line endings.
 */
export function tokenizeCsv(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += char;
      i++;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (char === "\r") {
      // Handled by \n branch
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += char;
    i++;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  return records;
}
