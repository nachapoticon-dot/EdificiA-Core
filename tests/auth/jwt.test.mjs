import test from "node:test";
import assert from "node:assert/strict";
import { isAuthStrictMode } from "../../src/lib/auth/jwt.ts";

test("isAuthStrictMode", async (t) => {
  await t.test("es estricto por defecto en production", () => {
    assert.equal(isAuthStrictMode({ NODE_ENV: "production" }), true);
  });

  await t.test("no es estricto por defecto en development", () => {
    assert.equal(isAuthStrictMode({ NODE_ENV: "development" }), false);
  });

  await t.test("AUTH_STRICT_MODE=true fuerza strict", () => {
    assert.equal(isAuthStrictMode({ NODE_ENV: "development", AUTH_STRICT_MODE: "true" }), true);
  });

  await t.test("AUTH_STRICT_MODE=false permite break-glass en production", () => {
    assert.equal(isAuthStrictMode({ NODE_ENV: "production", AUTH_STRICT_MODE: "false" }), false);
  });
});
