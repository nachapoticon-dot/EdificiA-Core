/**
 * Decodes the user ID from a JWT payload without signature verification.
 * We trust the InsForge backend for authentication — this is only used
 * server-side to extract the `sub` claim for DB queries.
 */
export function decodeUserId(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    return (JSON.parse(decoded) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/** Extracts the Bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string): string | null {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}
