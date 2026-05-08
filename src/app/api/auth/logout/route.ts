import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.delete("insforge_csrf_token");

  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      cookieStore.delete(c.name);
    }
  }

  return Response.json({ ok: true });
}
