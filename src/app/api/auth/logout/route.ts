import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  // Clear InsForge auth cookies
  cookieStore.delete("insforge_csrf_token");
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) cookieStore.delete(c.name);
  }

  // Clear our session cookie (set with path=/)
  cookieStore.set("edificia_session", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });

  return Response.json({ ok: true });
}
