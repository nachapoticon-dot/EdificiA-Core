import { generateInformePdfBuffer, type InformeData } from "@/lib/export/generate-pdf";
import { requireAuth } from "@/lib/auth/require-auth";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: InformeData & { fileName?: string };
  try {
    body = (await req.json()) as InformeData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.title || !body.veredicto) {
    return new Response("title and veredicto are required", { status: 400 });
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
