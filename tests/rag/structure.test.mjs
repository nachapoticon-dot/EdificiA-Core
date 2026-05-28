import test from "node:test";
import assert from "node:assert/strict";
import {
  extractStructuredSections,
  getDocumentStructureSummary,
} from "../../src/lib/rag/structure.ts";
import { chunkDocument } from "../../src/lib/rag/chunker.ts";
import { readinessFromIndexingStatus } from "../../src/lib/enterprise-context/document-sync.ts";

const structuredText = [
  "1. PLIEGO TECNICO",
  "Este tramo describe condiciones generales de obra, alcance, seguridad y documentación inicial.",
  "1.1 Movimiento de suelo",
  "Se ejecutara replanteo, excavacion, retiro de material y compactacion por capas.",
  "2. HORMIGON ARMADO",
  "Incluye encofrados, armaduras, colado, curado, controles y registros de calidad.",
].join("\n");

test("extrae secciones jerarquicas desde titulos numerados", () => {
  const sections = extractStructuredSections(structuredText);

  assert.equal(sections.length, 3);
  assert.deepEqual(sections[0].path, ["1. PLIEGO TECNICO"]);
  assert.deepEqual(sections[1].path, ["1. PLIEGO TECNICO", "1.1 Movimiento de suelo"]);
  assert.equal(sections[1].level, 2);
  assert.equal(sections[1].metadata, undefined);
});

test("resume estructura documental para pdf textual, plano y escaneado", () => {
  const pdf = {
    type: "pdf",
    fileName: "pliego.pdf",
    fileSize: 1000,
    pageCount: 4,
    text: structuredText,
    isScanned: false,
    pageImages: [],
  };

  const summary = getDocumentStructureSummary(pdf);
  assert.equal(summary.status, "structured");
  assert.equal(summary.sectionCount, 3);
  assert.equal(summary.maxDepth, 2);
  assert.deepEqual(summary.topSections, ["1. PLIEGO TECNICO", "2. HORMIGON ARMADO"]);

  const scanned = getDocumentStructureSummary({ ...pdf, text: "", isScanned: true });
  assert.equal(scanned.status, "scanned");

  const flat = getDocumentStructureSummary({ ...pdf, text: "Texto corrido sin encabezados claros.\nOtro parrafo breve." });
  assert.equal(flat.status, "flat");
});

test("propaga rutas de seccion a los chunks", () => {
  const chunks = chunkDocument({
    type: "pdf",
    fileName: "pliego.pdf",
    fileSize: 1000,
    pageCount: 4,
    text: structuredText,
    isScanned: false,
    pageImages: [],
  });

  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[1].metadata.section_path, ["1. PLIEGO TECNICO", "1.1 Movimiento de suelo"]);
  assert.equal(chunks[1].metadata.section_level, 2);
  assert.match(chunks[1].text, /^Sección: 1\. PLIEGO TECNICO > 1\.1 Movimiento de suelo/);
});

test("mapea estado de indexacion a readiness enterprise", () => {
  assert.equal(readinessFromIndexingStatus("pending"), "inventariada");
  assert.equal(readinessFromIndexingStatus("indexed"), "indexada");
  assert.equal(readinessFromIndexingStatus("degraded"), "observada");
  assert.equal(readinessFromIndexingStatus("failed"), "observada");
});
