const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";

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

// Cache: last 20 chars of token → { userId | null, expiresAt }
// Avoids a round-trip to InsForge on every API call.
const _verifyCache = new Map<string, { userId: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export function isAuthStrictMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUTH_STRICT_MODE === "true") return true;
  if (env.AUTH_STRICT_MODE === "false") return false;
  return env.NODE_ENV === "production";
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

/**
 * Verifies a JWT by calling the InsForge auth endpoint server-side.
 * Results are cached for 60 s to avoid per-request latency.
 * Development can fall back to decode-only if InsForge is unreachable.
 * Production is strict by default; set AUTH_STRICT_MODE=false only for emergency break-glass.
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
      if (res.ok) {
        _verifyCache.set(cacheKey, { userId: claims.sub, expiresAt: Date.now() + CACHE_TTL_MS });
        // Prune stale entries
        if (_verifyCache.size > 1000) {
          const now = Date.now();
          for (const [k, v] of _verifyCache) {
            if (v.expiresAt < now) _verifyCache.delete(k);
          }
        }
        return claims.sub;
      }
      // InsForge returned non-ok (token from a different project, or project recreated)
      // Fall through to decode-only fallback below
    } catch {
      // Network error — fall through to decode-only fallback
    }
  }

  // In strict mode (production), reject tokens we can't verify against InsForge.
  if (isAuthStrictMode()) return null;

  // Fallback: trust local decode (exp already verified above)
  return claims.sub;
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string): string | null {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
