import { generateInformePdfBuffer, type InformeData } from "@/lib/export/generate-pdf";
import { decodeUserId } from "@/lib/auth/jwt";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return new Response("Invalid token", { status: 401 });

  let body: InformeData & { fileName?: string };
  try {
    body = (await req.json()) as InformeData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.title || !body.veredicto) {
    return new Response("title and veredicto are required", { status: 400 });
  }

  // Enrich with company name (best-effort)
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

  const buffer = await generateInformePdfBuffer(body);
  const safeFileName = (body.fileName ?? `Informe_${body.title}`)
    .replace(/[/\\?%*:|"<>]/g, "-") + ".pdf";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
