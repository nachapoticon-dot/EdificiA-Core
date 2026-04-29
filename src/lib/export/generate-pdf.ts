import type { UIMessage } from "ai";
import { markdownToHtml } from "./markdown-to-html";

function getTextFromMessage(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

export function exportAuditPdf(title: string, messages: UIMessage[]): void {
  const now = new Date().toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const messagesHtml = messages
    .map((msg) => {
      const text = getTextFromMessage(msg);
      if (!text.trim()) return "";
      if (msg.role === "user") {
        return `<div class="msg user"><span class="label">Auditor</span><p>${escapeHtml(text)}</p></div>`;
      }
      return `<div class="msg assistant"><span class="label">EdificIA</span>${markdownToHtml(text)}</div>`;
    })
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Auditoría EdificIA — ${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }

  header { border-bottom: 2px solid #1a1a1a; padding: 16px 32px 12px; display: flex; justify-content: space-between; align-items: flex-end; }
  header .brand { font-size: 18pt; font-weight: 700; letter-spacing: -0.5px; }
  header .brand span { color: #555; font-weight: 400; font-size: 10pt; }
  header .meta { text-align: right; font-size: 9pt; color: #555; }

  .doc-title { padding: 20px 32px 8px; font-size: 14pt; font-weight: 700; }
  .doc-subtitle { padding: 0 32px 20px; font-size: 9pt; color: #777; border-bottom: 1px solid #e5e5e5; }

  main { padding: 20px 32px; }

  .msg { margin-bottom: 16px; break-inside: avoid; }
  .label { display: inline-block; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
  .msg.user { padding: 10px 14px; background: #f5f5f5; border-radius: 6px; }
  .msg.user p { color: #444; font-size: 10pt; }
  .msg.assistant { padding: 10px 14px; border-left: 3px solid #1a1a1a; }

  h1 { font-size: 14pt; font-weight: 700; margin: 14px 0 6px; }
  h2 { font-size: 12pt; font-weight: 700; margin: 12px 0 5px; }
  h3 { font-size: 11pt; font-weight: 700; margin: 10px 0 4px; }
  h4 { font-size: 10pt; font-weight: 700; margin: 8px 0 3px; }
  p { line-height: 1.6; margin: 6px 0; }
  ul, ol { padding-left: 20px; margin: 6px 0; }
  li { line-height: 1.6; margin: 2px 0; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  code { font-family: 'Courier New', monospace; font-size: 9pt; background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f0f0f0; padding: 10px; border-radius: 4px; overflow: auto; margin: 8px 0; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 12px 0; }

  footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 32px; border-top: 1px solid #e5e5e5; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between; }

  @media print {
    body { font-size: 10pt; }
    footer { position: fixed; }
    .msg { break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <div class="brand">EdificIA <span>Plataforma de Auditoría para la Construcción</span></div>
  <div class="meta">${now}</div>
</header>
<div class="doc-title">${escapeHtml(title)}</div>
<div class="doc-subtitle">Informe de auditoría generado automáticamente · EdificIA v0.5.2</div>
<main>${messagesHtml}</main>
<footer>
  <span>EdificIA — Auditoría IA para la Construcción</span>
  <span>${escapeHtml(title)} · ${now}</span>
</footer>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
