import { timingSafeEqual } from "node:crypto";

/**
 * Valida `Authorization: Bearer <SUPER_ADMIN_KEY>` para las rutas /api/super-admin/*.
 * Devuelve false si la variable no está configurada. La comparación es de tiempo constante.
 */
export function isSuperAdminRequest(req: Request): boolean {
  const secret = process.env.SUPER_ADMIN_KEY;
  if (!secret) return false;
  const provided = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
