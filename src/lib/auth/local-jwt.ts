import { SignJWT, jwtVerify } from "jose";

/**
 * Firma y verificación local de JWT de sesión (HS256) — reemplaza la
 * verificación remota contra InsForge. Edge-safe (jose): usable también
 * desde src/proxy.ts.
 */

const ISSUER = "edificia";
const ACCESS_TOKEN_TTL = "1h";

/** La auth local está activa cuando la app corre sobre la capa de datos propia. */
export function isLocalAuthMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DATA_BACKEND === "postgres";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Missing AUTH_JWT_SECRET (mínimo 32 chars) — requerida con DATA_BACKEND=postgres");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionClaims {
  sub: string;
  email: string | null;
  name: string | null;
}

export async function signAccessToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email ?? undefined, name: claims.name ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: ISSUER });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}
