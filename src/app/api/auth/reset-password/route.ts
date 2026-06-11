import { z } from "zod";
import { localUpdatePassword } from "@/lib/auth/local-auth";
import { verifyResetToken } from "@/lib/auth/reset-token";

export const runtime = "nodejs";

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

  const updated = await localUpdatePassword(claims.userId, newPassword);
  if (!updated) {
    return Response.json({ error: "No se pudo actualizar la contraseña. Intentá de nuevo." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
