import { generatePresupuestoBuffer, type PresupuestoData } from "@/lib/export/generate-xlsx";
import { requireAuth } from "@/lib/auth/require-auth";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: PresupuestoData & { fileName?: string };
  try {
    body = (await req.json()) as PresupuestoData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.obraName || !Array.isArray(body.items) || body.items.length === 0) {
    return new Response("obraName and items are required", { status: 400 });
  }

  // Enrich with company name from org (best-effort)
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

  const buffer = generatePresupuestoBuffer(body);
  const safeFileName = (body.fileName ?? `Presupuesto_${body.obraName}`)
    .replace(/[/\\?%*:|"<>]/g, "-") + ".xlsx";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
