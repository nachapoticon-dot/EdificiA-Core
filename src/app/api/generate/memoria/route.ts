import { generateMemoriaBuffer, type MemoriaData } from "@/lib/export/generate-docx";
import { decodeUserId } from "@/lib/auth/jwt";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return new Response("Invalid token", { status: 401 });

  let body: MemoriaData & { fileName?: string };
  try {
    body = (await req.json()) as MemoriaData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.obraName || !Array.isArray(body.sections) || body.sections.length === 0) {
    return new Response("obraName and sections are required", { status: 400 });
  }

  // Enrich with company name from org (best-effort)
  try {
    const client = getInsForgeAdminClient();
    const result = await client.database
      .from("organization_members")
      .select("organizations(name)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    const orgName = (result.data as { organizations: { name: string } | null } | null)
      ?.organizations?.name;
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
