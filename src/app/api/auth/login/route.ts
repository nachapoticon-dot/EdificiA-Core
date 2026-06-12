import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { localFindUserIdByEmail } from "@/lib/auth/local-auth";
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
    // Si el email ni siquiera está registrado, distinguir el caso "sin invitación"
    // del caso "contraseña incorrecta" (producto invite-only: el mensaje guía al acceso).
    const userId = await localFindUserIdByEmail(parsed.data.email);
    if (userId) {
      return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const nowIso = new Date().toISOString();
    const [founderInv, memberInv] = await Promise.all([
      client.database
        .from("org_founder_invitations")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .limit(1),
      client.database
        .from("organization_invitations")
        .select("id")
        .eq("invited_email", email)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .limit(1),
    ]);
    const hasInvitation =
      ((founderInv.data as unknown[] | null)?.length ?? 0) > 0 ||
      ((memberInv.data as unknown[] | null)?.length ?? 0) > 0;

    if (hasInvitation) {
      return Response.json(
        {
          error: "Tu invitación está pendiente de activación. Creá tu cuenta desde «Activar cuenta» para ingresar.",
          code: "invitation_pending",
        },
        { status: 403 },
      );
    }

    return Response.json(
      {
        error: "No detectamos ninguna invitación con este email. Contactá al administrador de tu empresa para recibir acceso.",
        code: "no_invitation",
      },
      { status: 403 },
    );
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
