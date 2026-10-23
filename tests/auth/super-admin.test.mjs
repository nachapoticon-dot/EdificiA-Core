import { test } from "node:test";
import assert from "node:assert/strict";
import { isSuperAdminRequest } from "../../src/lib/auth/super-admin.ts";

const req = (auth) => new Request("http://x", { headers: auth ? { authorization: auth } : {} });

test("isSuperAdminRequest valida el Bearer contra SUPER_ADMIN_KEY", () => {
  process.env.SUPER_ADMIN_KEY = "s3cret-key";
  assert.equal(isSuperAdminRequest(req("Bearer s3cret-key")), true);
  assert.equal(isSuperAdminRequest(req("Bearer otra")), false);
  assert.equal(isSuperAdminRequest(req()), false);
  delete process.env.SUPER_ADMIN_KEY;
  assert.equal(isSuperAdminRequest(req("Bearer ")), false);
});
