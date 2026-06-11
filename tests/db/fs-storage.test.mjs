import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "edificia-storage-"));
process.env.STORAGE_DIR = tmpRoot;

const { getFsStorage } = await import("../../src/lib/storage/fs-adapter.ts");

test("upload/download/remove roundtrip con mime inferido", async (t) => {
  t.after(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });
  const bucket = getFsStorage().from("presupuestos");

  const content = new Blob(["%PDF-1.4 contenido de prueba"], { type: "application/pdf" });
  const uploaded = await bucket.upload("123_presupuesto.pdf", content);
  assert.equal(uploaded.error, null);
  assert.equal(uploaded.data?.key, "123_presupuesto.pdf");

  const downloaded = await bucket.download("123_presupuesto.pdf");
  assert.equal(downloaded.error, null);
  assert.equal(downloaded.data?.type, "application/pdf");
  assert.equal(await downloaded.data.text(), "%PDF-1.4 contenido de prueba");

  const removed = await bucket.remove(["123_presupuesto.pdf", "no_existe.pdf"]);
  assert.equal(removed.error, null); // ENOENT se ignora

  const gone = await bucket.download("123_presupuesto.pdf");
  assert.equal(gone.data, null);
  assert.equal(gone.error?.code, "ENOENT");
});

test("path traversal rechazado", async () => {
  const bucket = getFsStorage().from("presupuestos");
  const result = await bucket.upload("../../etc/passwd", new Blob(["x"]));
  assert.equal(result.data, null);
  assert.match(result.error?.message ?? "", /inválida/);
});
