/** Signs and verifies password-reset tokens using HMAC-SHA256 (Web Crypto — no extra deps). */

const EXPIRY_SECS = 3600; // 1 h

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function urlB64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

function getSecret(): string {
  const secret = process.env.PASSWORD_RESET_SECRET ?? process.env.INSFORGE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "edificia-reset-dev-secret";
  throw new Error("Missing PASSWORD_RESET_SECRET or INSFORGE_SERVICE_ROLE_KEY");
}

export async function signResetToken(userId: string, email: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECS;
  const payload = Buffer.from(JSON.stringify({ userId, email, exp })).toString("base64url");
  const key = await hmacKey(getSecret());
  const sig = urlB64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${payload}.${sig}`;
}

export async function verifyResetToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey(getSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sig, "base64url"),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId: string;
      email: string;
      exp: number;
    };
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: claims.userId, email: claims.email };
  } catch {
    return null;
  }
}
