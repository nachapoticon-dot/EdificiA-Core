import { Resend } from "resend";
import { writeAuditLogEvent } from "@/lib/audit/audit-log";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { dbLogger } from "@/lib/logger";

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const MAX_RECIPIENTS = 5;
const MAX_SUBJECT_LEN = 160;
const MAX_BODY_LEN = 5000;

export interface SendStakeholderEmailInput {
  organizationId: string;
  projectId: string;
  actorUserId?: string | null;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  scheduleTaskId?: string | null;
  subcontractId?: string | null;
}

export interface SendStakeholderEmailResult {
  ok: boolean;
  reason?: string;
  message: string;
  sentTo: string[];
  blockedTo: string[];
  whitelistSize: number;
  messageId?: string;
}

interface WhitelistRow {
  contact_email: string | null;
}

async function loadWhitelist(organizationId: string, projectId: string): Promise<Set<string>> {
  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("project_subcontracts")
    .select("contact_email")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (result.error) {
    dbLogger.warn({ err: result.error }, "stakeholder_whitelist_query_failed");
    return new Set();
  }

  const rows = (result.data ?? []) as WhitelistRow[];
  return new Set(
    rows
      .map((r) => r.contact_email?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
}

function normalize(emails: string[]): string[] {
  return emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function dedupe(emails: string[]): string[] {
  return Array.from(new Set(emails));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:14px;color:#27272a;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#18181b;padding:24px 32px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
              Edific<span style="color:#f59e0b;">IA</span>
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#a1a1aa;letter-spacing:0.4px;text-transform:uppercase;">
              Comunicación operativa de obra
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 18px;font-size:18px;font-weight:600;color:#18181b;">${escapeHtml(subject)}</h1>
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;">
              Este mensaje fue enviado desde EdificIA por el PM de la obra. Si lo recibís por error, ignoralo.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendStakeholderEmail(input: SendStakeholderEmailInput): Promise<SendStakeholderEmailResult> {
  const to = dedupe(normalize(input.to));
  const cc = dedupe(normalize(input.cc ?? []));
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (to.length === 0) {
    return { ok: false, reason: "missing_recipients", message: "Indicá al menos un destinatario.", sentTo: [], blockedTo: [], whitelistSize: 0 };
  }
  if (to.length + cc.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      reason: "too_many_recipients",
      message: `No se permiten más de ${MAX_RECIPIENTS} destinatarios entre to + cc.`,
      sentTo: [],
      blockedTo: to,
      whitelistSize: 0,
    };
  }
  if (!subject || subject.length > MAX_SUBJECT_LEN) {
    return { ok: false, reason: "invalid_subject", message: `El asunto debe tener entre 3 y ${MAX_SUBJECT_LEN} caracteres.`, sentTo: [], blockedTo: to, whitelistSize: 0 };
  }
  if (!body || body.length > MAX_BODY_LEN) {
    return { ok: false, reason: "invalid_body", message: `El cuerpo del email debe tener entre 10 y ${MAX_BODY_LEN} caracteres.`, sentTo: [], blockedTo: to, whitelistSize: 0 };
  }

  const whitelist = await loadWhitelist(input.organizationId, input.projectId);

  if (whitelist.size === 0) {
    return {
      ok: false,
      reason: "empty_whitelist",
      message:
        "La obra no tiene stakeholders con email registrado. Cargá contactos en project_subcontracts antes de enviar comunicaciones.",
      sentTo: [],
      blockedTo: to,
      whitelistSize: 0,
    };
  }

  const blockedTo: string[] = [];
  const allowedTo: string[] = [];
  for (const email of to) {
    if (whitelist.has(email)) allowedTo.push(email);
    else blockedTo.push(email);
  }
  const blockedCc: string[] = [];
  const allowedCc: string[] = [];
  for (const email of cc) {
    if (whitelist.has(email)) allowedCc.push(email);
    else blockedCc.push(email);
  }

  if (allowedTo.length === 0) {
    return {
      ok: false,
      reason: "whitelist_blocked",
      message: `Ningún destinatario está en la whitelist de la obra. Bloqueados: ${blockedTo.join(", ")}.`,
      sentTo: [],
      blockedTo: [...blockedTo, ...blockedCc],
      whitelistSize: whitelist.size,
    };
  }

  if (!process.env.RESEND_API_KEY) {
    dbLogger.warn("send_stakeholder_email_skipped: RESEND_API_KEY missing");
    await writeAuditLogEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      eventType: "email.stakeholder_dry_run",
      entityType: "stakeholder_email",
      severity: "warning",
      payload: { to: allowedTo, cc: allowedCc, subject, blockedTo, blockedCc, reason: "no_api_key" },
    });
    return {
      ok: false,
      reason: "no_api_key",
      message: "RESEND_API_KEY no está configurada. El envío quedó registrado como dry-run en el audit log.",
      sentTo: [],
      blockedTo: [...blockedTo, ...blockedCc],
      whitelistSize: whitelist.size,
    };
  }

  let messageId: string | undefined;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const send = await resend.emails.send({
      from: FROM,
      to: allowedTo,
      cc: allowedCc.length > 0 ? allowedCc : undefined,
      subject,
      html: buildHtml(subject, body),
      text: body,
    });
    if (send.error) {
      dbLogger.warn({ err: send.error }, "send_stakeholder_email_failed");
      await writeAuditLogEvent({
        organizationId: input.organizationId,
        projectId: input.projectId,
        actorUserId: input.actorUserId ?? null,
        eventType: "email.stakeholder_failed",
        entityType: "stakeholder_email",
        severity: "warning",
        payload: { to: allowedTo, cc: allowedCc, subject, error: send.error.message ?? "send_failed" },
      });
      return {
        ok: false,
        reason: "send_failed",
        message: `Resend rechazó el envío: ${send.error.message ?? "error desconocido"}.`,
        sentTo: [],
        blockedTo: [...blockedTo, ...blockedCc],
        whitelistSize: whitelist.size,
      };
    }
    messageId = send.data?.id;
  } catch (err) {
    dbLogger.warn({ err }, "send_stakeholder_email_exception");
    return {
      ok: false,
      reason: "send_exception",
      message: err instanceof Error ? err.message : "Excepción enviando email.",
      sentTo: [],
      blockedTo: [...blockedTo, ...blockedCc],
      whitelistSize: whitelist.size,
    };
  }

  await writeAuditLogEvent({
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorUserId: input.actorUserId ?? null,
    eventType: "email.stakeholder_sent",
    entityType: "stakeholder_email",
    entityId: messageId ?? null,
    severity: "info",
    payload: {
      to: allowedTo,
      cc: allowedCc,
      subject,
      bodyLength: body.length,
      blockedTo,
      blockedCc,
      messageId: messageId ?? null,
      scheduleTaskId: input.scheduleTaskId ?? null,
      subcontractId: input.subcontractId ?? null,
    },
  });

  const sentTotal = allowedTo.length + allowedCc.length;
  const blockedTotal = blockedTo.length + blockedCc.length;
  const parts = [`Email enviado a ${sentTotal} destinatario(s)`];
  if (blockedTotal > 0) parts.push(`${blockedTotal} bloqueado(s) por whitelist`);

  return {
    ok: true,
    message: parts.join(" · ") + ".",
    sentTo: [...allowedTo, ...allowedCc],
    blockedTo: [...blockedTo, ...blockedCc],
    whitelistSize: whitelist.size,
    messageId,
  };
}
