import { z } from "zod";
import { localFindUserIdByEmail } from "@/lib/auth/local-auth";
import { signResetToken } from "@/lib/auth/reset-token";
import { sendPasswordResetEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

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
    const userId = await localFindUserIdByEmail(email);
    if (userId) {
      const token = await signResetToken(userId, email);
      await sendPasswordResetEmail({ toEmail: email, token });
    }
  } catch {
    // Any error is swallowed — always return ok to prevent enumeration
  }

  return Response.json({ ok: true });
}
