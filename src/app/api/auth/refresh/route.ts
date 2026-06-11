import { z } from "zod";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SESSION_COOKIE = "edificia_session";

const schema = z.object({ refreshToken: z.string().min(10) });

/**
 * Renueva el access token usando un refresh token (con rotación).
 * El browser lo llama desde getAuthToken() cuando el access está por expirar.
 */
export async function POST(req: Request): Promise<Response> {
  if (!checkRateLimit(rateLimitKey(req, "refresh"), "auth")) {
    return Response.json({ error: "Demasiados intentos. Esperá un minuto." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Request inválido." }, { status: 400 });

  const client = getInsForgeAdminClient();
  const { data, error } = await client.auth.refreshSession({ refreshToken: parsed.data.refreshToken });
  const accessToken = (data as { accessToken?: string } | null)?.accessToken;
  const refreshToken = (data as { refreshToken?: string } | null)?.refreshToken ?? null;

  if (error || !accessToken) {
    return Response.json({ error: "Sesión expirada. Iniciá sesión de nuevo." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return Response.json({ ok: true, accessToken, refreshToken });
}
