const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";

interface JwtClaims {
  sub?: string;
  email?: string;
  exp?: number;
}

// Cache: last 20 chars of token → { userId | null, expiresAt }
// Avoids a round-trip to InsForge on every API call.
const _verifyCache = new Map<string, { userId: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Decodes and validates a JWT's `sub` claim.
 * Does NOT verify the signature — use verifyUserId for server-side auth.
 */
export function decodeUserId(jwt: string): string | null {
  return decodeClaims(jwt)?.sub ?? null;
}

/** Decodes userId + email from the JWT payload without verifying signature. */
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

/**
 * Verifies a JWT by calling the InsForge auth endpoint server-side.
 * Results are cached for 60 s to avoid per-request latency.
 * Falls back to decode-only (exp check only) if InsForge is unreachable.
 */
export async function verifyUserId(token: string): Promise<string | null> {
  // Fast path: check structure + exp locally first
  const claims = decodeClaims(token);
  if (!claims) return null;

  const cacheKey = token.slice(-20);
  const cached = _verifyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.userId;

  if (INSFORGE_URL) {
    try {
      const res = await fetch(`${INSFORGE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      const userId = res.ok ? claims.sub : null;
      _verifyCache.set(cacheKey, { userId, expiresAt: Date.now() + CACHE_TTL_MS });
      // Prune stale entries
      if (_verifyCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of _verifyCache) {
          if (v.expiresAt < now) _verifyCache.delete(k);
        }
      }
      return userId;
    } catch {
      // Network error — fall through to decode-only fallback
    }
  }

  // Fallback: trust local decode (exp already verified above)
  return claims.sub;
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string): string | null {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
