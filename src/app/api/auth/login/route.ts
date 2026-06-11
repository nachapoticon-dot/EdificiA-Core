import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { loginSchema } from "@/lib/validators";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SESSION_COOKIE = "edificia_session";

export async function POST(req: Request): Promise<Response> {
  const rlKey = rateLimitKey(req, "login");
  if (!checkRateLimit(rlKey, "auth")) {
    return Response.json({ error: "Demasiados intentos. Esperá un minuto." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request inválido." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Email o contraseña inválidos." }, { status: 400 });
  }

  const client = getInsForgeAdminClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data) {
    return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  const accessToken = (data as { accessToken?: string }).accessToken ?? null;

  if (!accessToken) {
    return Response.json({ error: "Error al autenticar. Intentá de nuevo." }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return Response.json({
    ok: true,
    accessToken,
    refreshToken: (data as { refreshToken?: string }).refreshToken ?? null,
  });
}
