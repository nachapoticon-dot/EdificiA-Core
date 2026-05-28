import type { ProcessedFile } from "@/lib/file-processor/types";

export interface StructuredSection {
  id: string;
  title: string;
  level: number;
  order: number;
  path: string[];
  content: string;
  lineStart: number;
  lineEnd: number;
}

export interface DocumentStructureSummary {
  status: "structured" | "flat" | "scanned" | "unsupported";
  sectionCount: number;
  maxDepth: number;
  topSections: string[];
}

interface HeadingCandidate {
  title: string;
  level: number;
}

const MAX_TITLE_LENGTH = 110;

export function extractStructuredSections(text: string): StructuredSection[] {
  const lines = text.split("\n");
  const sections: Array<Omit<StructuredSection, "id" | "order" | "path" | "lineEnd"> & { lines: string[] }> = [];
  let current: { title: string; level: number; lineStart: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const heading = detectHeading(raw);

    if (heading) {
      if (current && current.lines.join("\n").trim().length > 30) {
        sections.push({ ...current, content: current.lines.join("\n").trim() });
      }
      current = { title: heading.title, level: heading.level, lineStart: i, lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(raw);
    } else if (raw.trim()) {
      current = { title: "Inicio", level: 1, lineStart: i, lines: [raw] };
    }
  }

  if (current && current.lines.join("\n").trim().length > 30) {
    sections.push({ ...current, content: current.lines.join("\n").trim() });
  }

  if (sections.length <= 1) return [];

  const stack: Array<{ level: number; title: string }> = [];
  return sections.map((section, index) => {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= section.level) stack.pop();
    stack.push({ level: section.level, title: section.title });
    return {
      id: `s${index + 1}`,
      title: section.title,
      level: section.level,
      order: index,
      path: stack.map((item) => item.title),
      content: section.content,
      lineStart: section.lineStart,
      lineEnd: index < sections.length - 1 ? sections[index + 1]!.lineStart - 1 : lines.length - 1,
    };
  });
}

export function getDocumentStructureSummary(file: ProcessedFile): DocumentStructureSummary {
  if (file.type === "pdf" && file.isScanned) {
    return { status: "scanned", sectionCount: 0, maxDepth: 0, topSections: [] };
  }

  if (file.type === "pdf" || file.type === "docx") {
    const sections = extractStructuredSections(file.text);
    if (sections.length === 0) {
      return { status: "flat", sectionCount: 0, maxDepth: 0, topSections: [] };
    }
    return summarizeSections(sections);
  }

  if (file.type === "excel") {
    const rubros = detectExcelRubros(file.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })));
    return {
      status: rubros.length > 0 ? "structured" : "flat",
      sectionCount: rubros.length,
      maxDepth: rubros.length > 0 ? 1 : 0,
      topSections: rubros.slice(0, 8),
    };
  }

  if (file.type === "dxf") {
    return {
      status: "structured",
      sectionCount: file.layers.length,
      maxDepth: file.layers.length > 0 ? 1 : 0,
      topSections: file.layers.slice(0, 8),
    };
  }

  return { status: "unsupported", sectionCount: 0, maxDepth: 0, topSections: [] };
}

export function structureMetadata(file: ProcessedFile): Record<string, unknown> {
  const summary = getDocumentStructureSummary(file);
  return {
    document_structure: summary,
  };
}

function summarizeSections(sections: StructuredSection[]): DocumentStructureSummary {
  const topSections = sections
    .filter((section) => section.level === Math.min(...sections.map((s) => s.level)))
    .map((section) => section.title)
    .slice(0, 8);

  return {
    status: "structured",
    sectionCount: sections.length,
    maxDepth: Math.max(...sections.map((section) => section.level), 1),
    topSections,
  };
}

function detectHeading(line: string): HeadingCandidate | null {
  const title = line.trim().replace(/\s+/g, " ");
  if (title.length < 4 || title.length > MAX_TITLE_LENGTH) return null;
  if (/[.;:]$/.test(title) && title.split(/\s+/).length > 8) return null;

  const numbered = title.match(/^(\d+(?:\.\d+){0,4})[\).\-\s]+(.+)$/);
  if (numbered) {
    const marker = numbered[1] ?? "";
    const rest = (numbered[2] ?? "").trim();
    if (rest.length >= 3) return { title, level: marker.split(".").length };
  }

  if (/^[IVXLC]{1,6}[\).\-\s]+[A-ZÁÉÍÓÚÑ]/.test(title)) {
    return { title, level: 1 };
  }

  const letters = title.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length >= 6) {
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;
    const ratio = upper / letters.length;
    if (ratio > 0.82) return { title, level: 1 };
  }

  return null;
}

function detectExcelRubros(items: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }>): string[] {
  return items
    .filter((item) =>
      item.quantity === 0 &&
      item.unitPrice === 0 &&
      item.totalPrice === 0 &&
      item.description.trim().length > 0)
    .map((item) => item.description.trim())
    .slice(0, 30);
}
