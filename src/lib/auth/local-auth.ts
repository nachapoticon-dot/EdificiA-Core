import { createHash, randomBytes } from "node:crypto";
import { sqlQuery } from "@/lib/db/sql";
import { signAccessToken } from "./local-jwt";
import { hashPassword, verifyPassword } from "./password";

/**
 * Auth local sobre auth.users / auth.refresh_tokens (reemplaza InsForge Auth).
 * Las funciones devuelven { data, error } con las mismas formas que el SDK
 * esperaba en los call-sites (user.id, profile.name, accessToken/refreshToken),
 * para que las rutas existentes funcionen sin reescritura mayor.
 */

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días, con rotación

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function localSignUp(args: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ data: { user: { id: string; email: string; name: string | null } } | null; error: { message: string } | null }> {
  const email = args.email.toLowerCase().trim();
  try {
    const rows = await sqlQuery<UserRow>(
      `INSERT INTO auth.users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name, password_hash`,
      [email, args.name?.trim() || null, await hashPassword(args.password)],
    );
    const user = rows[0];
    if (!user) return { data: null, error: { message: "No se pudo crear el usuario." } };
    return { data: { user: { id: user.id, email: user.email, name: user.name } }, error: null };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") {
      // mensaje compatible: las rutas matchean "already registered"/"already exists"
      return { data: null, error: { message: "User already registered" } };
    }
    return { data: null, error: { message: (err as Error).message } };
  }
}

export async function localSignIn(args: {
  email: string;
  password: string;
}): Promise<{
  data: { accessToken: string; refreshToken: string; user: { id: string; email: string; name: string | null } } | null;
  error: { message: string } | null;
}> {
  const email = args.email.toLowerCase().trim();
  const rows = await sqlQuery<UserRow>(
    "SELECT id, email, name, password_hash FROM auth.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1",
    [email],
  );
  const user = rows[0];
  // password_hash NULL = usuario importado de InsForge sin credencial local → debe resetear
  if (!user || !user.password_hash || !(await verifyPassword(args.password, user.password_hash))) {
    return { data: null, error: { message: "Invalid credentials" } };
  }

  const accessToken = await signAccessToken({ sub: user.id, email: user.email, name: user.name });
  const refreshToken = await issueRefreshToken(user.id);
  return {
    data: { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } },
    error: null,
  };
}

export async function localRefresh(refreshToken: string): Promise<{
  data: { accessToken: string; refreshToken: string } | null;
  error: { message: string } | null;
}> {
  const rows = await sqlQuery<{ id: string; user_id: string; email: string; name: string | null }>(
    `SELECT rt.id, rt.user_id, u.email, u.name
     FROM auth.refresh_tokens rt
     JOIN auth.users u ON u.id = rt.user_id AND u.deleted_at IS NULL
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()
     LIMIT 1`,
    [sha256(refreshToken)],
  );
  const row = rows[0];
  if (!row) return { data: null, error: { message: "Invalid refresh token" } };

  // Rotación: revocar el usado, emitir uno nuevo
  await sqlQuery("UPDATE auth.refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);
  const accessToken = await signAccessToken({ sub: row.user_id, email: row.email, name: row.name });
  const newRefreshToken = await issueRefreshToken(row.user_id);
  return { data: { accessToken, refreshToken: newRefreshToken }, error: null };
}

export async function localGetProfile(userId: string): Promise<{
  data: { profile: { name: string | null } } | null;
  error: { message: string } | null;
}> {
  const rows = await sqlQuery<{ name: string | null }>(
    "SELECT name FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
    [userId],
  );
  const user = rows[0];
  if (!user) return { data: null, error: { message: "User not found" } };
  return { data: { profile: { name: user.name } }, error: null };
}

export async function localFindUserIdByEmail(email: string): Promise<string | null> {
  const rows = await sqlQuery<{ id: string }>(
    "SELECT id FROM auth.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1",
    [email.toLowerCase().trim()],
  );
  return rows[0]?.id ?? null;
}

export async function localUpdatePassword(userId: string, newPassword: string): Promise<boolean> {
  const rows = await sqlQuery<{ id: string }>(
    "UPDATE auth.users SET password_hash = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [userId, await hashPassword(newPassword)],
  );
  if (rows.length === 0) return false;
  // Cambió la credencial: revocar sesiones de refresh vigentes
  await sqlQuery("UPDATE auth.refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  return true;
}

async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  await sqlQuery(
    "INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, sha256(token), new Date(Date.now() + REFRESH_TTL_MS)],
  );
  return token;
}
