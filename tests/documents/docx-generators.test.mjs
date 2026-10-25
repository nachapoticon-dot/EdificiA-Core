import test from "node:test";
import assert from "node:assert/strict";
import { generateMemoriaBuffer } from "../../src/lib/export/generate-docx.ts";

// Un .docx es un ZIP: empieza con la firma "PK".
function isDocxBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 200 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

test("generateMemoriaBuffer", async (t) => {
  await t.test("produce un .docx válido con una sección", async () => {
    const buffer = await generateMemoriaBuffer({
      obraName: "Edificio Norte",
      sections: [{ title: "Descripción general", content: "Vivienda multifamiliar de 4 plantas." }],
    });
    assert.ok(isDocxBuffer(buffer));
  });

  await t.test("acepta varias secciones y redactor", async () => {
    const buffer = await generateMemoriaBuffer({
      obraName: "Obra Z",
      redactor: "Arq. Pérez",
      sections: [
        { title: "Alcance", content: "Estructura y albañilería." },
        { title: "Materiales", content: "Hormigón H21, ladrillo hueco 18." },
      ],
    });
    assert.ok(isDocxBuffer(buffer));
  });
});
