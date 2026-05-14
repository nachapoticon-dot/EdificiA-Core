import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  engineer: "Ingeniero",
  viewer: "Visualizador",
};

interface InvitationEmailParams {
  toEmail: string;
  orgName: string;
  role: string;
  /** Invitation token — used to pre-fill /register */
  token: string;
}

interface PasswordResetEmailParams {
  toEmail: string;
  token: string;
}

export async function sendPasswordResetEmail({
  toEmail,
  token,
}: PasswordResetEmailParams): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: "Recuperación de contraseña — EdificIA",
    html: buildResetEmailHtml({ toEmail, resetUrl }),
  });
}

function buildResetEmailHtml(params: { toEmail: string; resetUrl: string }): string {
  const { toEmail, resetUrl } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperación de contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#18181b;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Edific<span style="color:#f59e0b;">IA</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#a1a1aa;">
                Plataforma de inteligencia para constructoras
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
                Recuperación de contraseña
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                Recibiste este email porque solicitaste restablecer la contraseña de
                <strong style="color:#18181b;">${toEmail}</strong>.
                El link expira en <strong>1 hora</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#18181b;border-radius:8px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      Restablecer contraseña →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no será modificada.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
                EdificIA — Plataforma B2B para empresas constructoras
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a transactional invitation email via Resend.
 * The link goes to /register?email=... so the registration page
 * can auto-verify the invitation and pre-fill the email field.
 */
export async function sendInvitationEmail({
  toEmail,
  orgName,
  role,
  token,
}: InvitationEmailParams): Promise<void> {
  const registerUrl = `${APP_URL}/register?email=${encodeURIComponent(toEmail)}&token=${token}`;
  const roleLabel = ROLE_LABELS[role] ?? role;

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Fuiste invitado a ${orgName} en EdificIA`,
    html: buildEmailHtml({ orgName, roleLabel, registerUrl, toEmail }),
  });
}

function buildEmailHtml(params: {
  orgName: string;
  roleLabel: string;
  registerUrl: string;
  toEmail: string;
}): string {
  const { orgName, roleLabel, registerUrl, toEmail } = params;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a EdificIA</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Edific<span style="color:#f59e0b;">IA</span>
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#a1a1aa;">
                Plataforma de inteligencia para constructoras
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b;">
                Fuiste invitado a ${orgName}
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                Tenés una invitación para unirte a <strong style="color:#18181b;">${orgName}</strong>
                en EdificIA como <strong style="color:#18181b;">${roleLabel}</strong>.
                Hacé clic en el botón para crear tu cuenta.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#18181b;border-radius:8px;">
                    <a href="${registerUrl}"
                       style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      Aceptar invitación →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">
                      Detalles de la invitación
                    </p>
                    <p style="margin:4px 0;font-size:13px;color:#18181b;">
                      📧 <strong>Email:</strong> ${toEmail}
                    </p>
                    <p style="margin:4px 0;font-size:13px;color:#18181b;">
                      🏢 <strong>Empresa:</strong> ${orgName}
                    </p>
                    <p style="margin:4px 0 0;font-size:13px;color:#18181b;">
                      🔑 <strong>Rol:</strong> ${roleLabel}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Este link expira en <strong>7 días</strong>.
                Si no esperabas esta invitación, podés ignorar este email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;">
                EdificIA — Plataforma B2B para empresas constructoras
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
