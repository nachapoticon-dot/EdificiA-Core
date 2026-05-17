import test from "node:test";
import assert from "node:assert/strict";
import { computeSupplyStatus } from "../../src/lib/project-operations/supplies/supply-status.ts";

test("computeSupplyStatus", async (t) => {
  await t.test("received cuando received >= required", () => {
    assert.equal(computeSupplyStatus({ required: 100, ordered: 100, received: 100 }), "received");
    assert.equal(computeSupplyStatus({ required: 100, ordered: 100, received: 120 }), "received");
  });

  await t.test("partial cuando hay recepción parcial", () => {
    assert.equal(computeSupplyStatus({ required: 100, ordered: 100, received: 50 }), "partial");
  });

  await t.test("ordered cuando hay órdenes pero nada recibido", () => {
    assert.equal(computeSupplyStatus({ required: 100, ordered: 60, received: 0 }), "ordered");
    assert.equal(computeSupplyStatus({ required: 100, ordered: 60, received: null }), "ordered");
  });

  await t.test("planned cuando solo hay requerido", () => {
    assert.equal(computeSupplyStatus({ required: 100, ordered: null, received: null }), "planned");
    assert.equal(computeSupplyStatus({ required: 100, ordered: 0, received: 0 }), "planned");
  });

  await t.test("planned por default cuando faltan datos", () => {
    assert.equal(computeSupplyStatus({ required: null, ordered: null, received: null }), "planned");
  });
});
