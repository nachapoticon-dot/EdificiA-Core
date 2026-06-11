import { z } from "zod";
import { isLocalAuthMode } from "@/lib/auth/local-jwt";
import { localFindUserIdByEmail } from "@/lib/auth/local-auth";
import { signResetToken } from "@/lib/auth/reset-token";
import { sendPasswordResetEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.INSFORGE_SERVICE_ROLE_KEY ?? "";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: true }); // silent on bad body
  }

  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) return Response.json({ ok: true });

  const { email } = parsed.data;

  try {
    if (isLocalAuthMode()) {
      const userId = await localFindUserIdByEmail(email);
      if (userId) {
        const token = await signResetToken(userId, email);
        await sendPasswordResetEmail({ toEmail: email, token });
      }
      return Response.json({ ok: true }); // silencioso siempre — anti-enumeración
    }

    // Look up the user by email via InsForge admin API
    const usersRes = await fetch(
      `${INSFORGE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!usersRes.ok) return Response.json({ ok: true });

    const data = (await usersRes.json()) as { users?: { id: string }[] };
    const userId = data.users?.[0]?.id;
    if (!userId) return Response.json({ ok: true }); // user not found — silent to prevent enumeration

    const token = await signResetToken(userId, email);
    await sendPasswordResetEmail({ toEmail: email, token });
  } catch {
    // Any error is swallowed — always return ok to prevent enumeration
  }

  return Response.json({ ok: true });
}
