interface JwtClaims {
  sub?: string;
  email?: string;
  exp?: number;
}

/**
 * Decodes and validates a JWT's `sub` claim.
 *
 * InsForge SDK does not expose a server-side token verification endpoint,
 * so full signature verification relies on InsForge's edge layer.
 * We validate expiry (`exp`) and that the `sub` is a non-empty string —
 * the secondary DB query in each route further constrains the user to their org.
 */
export function decodeUserId(jwt: string): string | null {
  return decodeClaims(jwt)?.sub ?? null;
}

/** Decodes userId + email from the JWT payload. Email is present in Supabase-style tokens. */
export function decodeClaims(jwt: string): { sub: string; email: string | null } | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const claims = JSON.parse(decoded) as JwtClaims;
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    const sub = claims.sub;
    if (!sub || typeof sub !== "string" || sub.length < 10) return null;
    return { sub, email: claims.email ?? null };
  } catch {
    return null;
  }
}

/** Alias for route handlers that will add signature verification when InsForge exposes it. */
export async function verifyUserId(token: string): Promise<string | null> {
  return decodeUserId(token);
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string): string | null {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
