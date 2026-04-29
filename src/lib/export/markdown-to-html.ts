/**
 * Minimal markdown→HTML for audit exports.
 * Handles the subset Claude produces: headings, bold, italic,
 * ordered/unordered lists, horizontal rules, and code blocks.
 */
export function markdownToHtml(md: string): string {
  let html = md
    // Fenced code blocks → <pre><code>
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code: string) =>
      `<pre><code>${escHtml(code.trim())}</code></pre>`,
    )
    // Horizontal rule
    .replace(/^---+$/gm, "<hr>")
    // Headings h1-h4
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // Lists (process line by line)
  const lines = html.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const raw of lines) {
    const ulMatch = /^[-*•]\s+(.+)$/.exec(raw);
    const olMatch = /^\d+\.\s+(.+)$/.exec(raw);

    if (ulMatch) {
      if (!inUl) { if (inOl) { out.push("</ol>"); inOl = false; } out.push("<ul>"); inUl = true; }
      out.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inOl) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<ol>"); inOl = true; }
      out.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push(raw);
    }
  }
  if (inUl) out.push("</ul>");
  if (inOl) out.push("</ol>");

  // Paragraphs: blank lines → <p> boundaries
  return out
    .join("\n")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^(?!<[a-z])(.)/m, "<p>$1")
    .replace(/([^>])$/m, "$1</p>")
    .replace(/<p>\s*<\/p>/g, "");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
