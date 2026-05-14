import { generateMemoriaBuffer, type MemoriaData } from "@/lib/export/generate-docx";
import { requireAuth } from "@/lib/auth/require-auth";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: MemoriaData & { fileName?: string };
  try {
    body = (await req.json()) as MemoriaData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.obraName || !Array.isArray(body.sections) || body.sections.length === 0) {
    return new Response("obraName and sections are required", { status: 400 });
  }

  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("organizations")
      .select("name")
      .eq("id", auth.orgId)
      .single();
    const orgName = (result.data as { name?: string } | null)?.name;
    if (orgName && !body.companyName) body.companyName = orgName;
  } catch { /* best-effort */ }

  const buffer = await generateMemoriaBuffer(body);
  const safeFileName = (body.fileName ?? `Memoria_${body.obraName}`)
    .replace(/[/\\?%*:|"<>]/g, "-") + ".docx";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
