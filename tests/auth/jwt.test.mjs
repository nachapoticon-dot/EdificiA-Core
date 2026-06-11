import test from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "secreto-de-test-con-mas-de-32-caracteres!!";

const { signAccessToken, verifyAccessToken } = await import("../../src/lib/auth/local-jwt.ts");
const { verifyUserId, decodeClaims, extractBearerToken } = await import("../../src/lib/auth/jwt.ts");

test("auth local: firma y verificación HS256", async (t) => {
  const claims = { sub: "11111111-2222-4333-8444-555555555555", email: "a@b.com", name: "Ana" };
  const token = await signAccessToken(claims);

  await t.test("token firmado verifica y devuelve claims", async () => {
    const verified = await verifyAccessToken(token);
    assert.deepEqual(verified, claims);
  });

  await t.test("verifyUserId devuelve el sub", async () => {
    assert.equal(await verifyUserId(token), claims.sub);
  });

  await t.test("token adulterado se rechaza (sin fallback decode-only)", async () => {
    const [h, p] = token.split(".");
    const forged = `${h}.${p}.firma-invalida`;
    assert.equal(await verifyAccessToken(forged), null);
    assert.equal(await verifyUserId(forged), null);
    // pero el payload sigue siendo decodificable sin confianza:
    assert.equal(decodeClaims(forged)?.sub, claims.sub);
  });

  await t.test("token firmado con otro secret se rechaza", async () => {
    const original = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = "otro-secreto-distinto-de-mas-de-32-chars!!";
    try {
      assert.equal(await verifyAccessToken(token), null);
    } finally {
      process.env.AUTH_JWT_SECRET = original;
    }
  });
});

test("extractBearerToken", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(extractBearerToken("Basic xyz"), null);
});
