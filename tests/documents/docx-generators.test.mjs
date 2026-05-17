import test from "node:test";
import assert from "node:assert/strict";
import {
  generateOrdenCompraBuffer,
  generateActaObraBuffer,
} from "../../src/lib/export/generate-docx.ts";

// DOCX = ZIP file = starts with PK header (0x50 0x4B)
function isDocxBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 200 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

test("generateOrdenCompraBuffer", async (t) => {
  await t.test("produce un .docx válido con datos mínimos", async () => {
    const buffer = await generateOrdenCompraBuffer({
      obraName: "Torre Norte",
      vendor: { name: "Hormigonera Buenos Aires SA" },
      items: [{ description: "Hormigón H21", quantity: 50, unit: "m³", unitPrice: 25000 }],
    });
    assert.ok(isDocxBuffer(buffer), "buffer debe ser un DOCX (zip) válido");
  });

  await t.test("acepta IVA, condiciones y datos completos", async () => {
    const buffer = await generateOrdenCompraBuffer({
      obraName: "Edificio Sur",
      ordenNumber: "OC-2026-014",
      vendor: {
        name: "Aceros del Plata",
        contactName: "Juan Pérez",
        contactEmail: "ventas@aceros.com.ar",
        contactPhone: "+54 11 4444 5555",
      },
      buyer: { companyName: "Constructora XYZ", signedBy: "Ing. María Gómez" },
      items: [
        { description: "Hierro 8mm", quantity: 500, unit: "kg", unitPrice: 800 },
        { description: "Hierro 10mm", quantity: 300, unit: "kg", unitPrice: 850 },
      ],
      currency: "ARS",
      taxPct: 21,
      deliveryAddress: "Av. del Trabajo 1234, CABA",
      deliveryDate: "2026-06-15",
      paymentTerms: "50% anticipo, 50% contra entrega",
      notes: "Material certificado IRAM",
    });
    assert.ok(isDocxBuffer(buffer));
    assert.ok(buffer.length > 5000, "OC con datos completos debería pesar varios KB");
  });

  await t.test("calcula totales automáticamente cuando no se proveen", async () => {
    const buffer = await generateOrdenCompraBuffer({
      obraName: "Obra X",
      vendor: { name: "Proveedor Y" },
      items: [
        { description: "Item 1", quantity: 10, unit: "un", unitPrice: 100 },
        { description: "Item 2", quantity: 5, unit: "un", unitPrice: 200 },
      ],
    });
    assert.ok(isDocxBuffer(buffer));
  });
});

test("generateActaObraBuffer", async (t) => {
  await t.test("produce un .docx con tareas mínimas", async () => {
    const buffer = await generateActaObraBuffer({
      obraName: "Torre Norte",
      date: "2026-05-17",
      tasksExecuted: [{ description: "Hormigonado losa N+2.80" }],
    });
    assert.ok(isDocxBuffer(buffer));
  });

  await t.test("acepta cuadrilla, incidentes, materiales y visitas", async () => {
    const buffer = await generateActaObraBuffer({
      obraName: "Edificio Sur",
      date: "2026-05-17",
      weatherSummary: "Soleado, 22°C, sin lluvia",
      crew: [
        { role: "Capataz", name: "Roberto Díaz" },
        { role: "Oficial albañil", subcontractor: "Construcciones Norte", count: 6 },
      ],
      tasksExecuted: [
        { description: "Encofrado losa", progress: "80%", observations: "Falta zona ascensor" },
        { description: "Armado hierros", progress: "100%" },
      ],
      incidents: [
        { severity: "leve", description: "Tropiezo sin lesión en escalera N+1" },
        { severity: "moderado", description: "Demora en entrega de hormigón" },
      ],
      materialsReceived: [
        { item: "Hormigón H21", quantity: "12 m³", supplier: "Hormigonera BA" },
      ],
      visitsOnSite: [{ name: "Arq. López", role: "Director de obra" }],
      notes: "Reunión de coordinación 18hs.",
      signedBy: "Roberto Díaz",
    });
    assert.ok(isDocxBuffer(buffer));
    assert.ok(buffer.length > 5000);
  });

  await t.test("formatea fecha ISO a formato es-AR en el header", async () => {
    const buffer = await generateActaObraBuffer({
      obraName: "Obra Z",
      date: "2026-05-17",
      tasksExecuted: [{ description: "Limpieza general" }],
    });
    assert.ok(isDocxBuffer(buffer));
  });
});
