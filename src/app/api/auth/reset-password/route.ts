import { z } from "zod";
import { isLocalAuthMode } from "@/lib/auth/local-jwt";
import { localUpdatePassword } from "@/lib/auth/local-auth";
import { verifyResetToken } from "@/lib/auth/reset-token";

export const runtime = "nodejs";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.INSFORGE_SERVICE_ROLE_KEY ?? "";

const schema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(10, "La contraseña debe tener al menos 10 caracteres"),
});

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;

  const claims = await verifyResetToken(token);
  if (!claims) {
    return Response.json({ error: "El link expiró o no es válido. Solicitá uno nuevo." }, { status: 400 });
  }

  if (isLocalAuthMode()) {
    const updated = await localUpdatePassword(claims.userId, newPassword);
    if (!updated) {
      return Response.json({ error: "No se pudo actualizar la contraseña. Intentá de nuevo." }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  // Update the user's password via InsForge admin API
  const res = await fetch(`${INSFORGE_URL}/auth/v1/admin/users/${claims.userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ password: newPassword }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    return Response.json({ error: "No se pudo actualizar la contraseña. Intentá de nuevo." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
