import { verifyAccessToken } from "./local-jwt";

/**
 * Verificación de sesión — 100% local desde la desconexión de InsForge.
 * La firma HS256 se verifica con AUTH_JWT_SECRET (ver local-jwt.ts);
 * no hay fallback decode-only: token sin firma válida = sin sesión.
 */

interface JwtClaims {
  sub?: string;
  email?: string;
  exp?: number;
  name?: string;
  full_name?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
}

/**
 * Decodes and validates a JWT's `sub` claim.
 * Does NOT verify the signature — use verifyUserId for server-side auth.
 */
export function decodeUserId(jwt: string): string | null {
  return decodeClaims(jwt)?.sub ?? null;
}

/** Decodes userId + profile hints from the JWT payload without verifying signature. */
export function decodeClaims(jwt: string): { sub: string; email: string | null; name: string | null } | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const claims = JSON.parse(decoded) as JwtClaims;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    const sub = claims.sub;
    if (!sub || typeof sub !== "string" || sub.length < 10) return null;
    const name = claims.name ?? claims.full_name ?? claims.user_metadata?.name ?? claims.user_metadata?.full_name ?? null;
    return { sub, email: claims.email ?? null, name };
  } catch {
    return null;
  }
}

/** Verifica firma y expiración localmente y devuelve el userId, o null si el token no es válido. */
export async function verifyUserId(token: string): Promise<string | null> {
  const verified = await verifyAccessToken(token);
  return verified?.sub ?? null;
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string): string | null {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
