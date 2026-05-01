import { generatePresupuestoBuffer, type PresupuestoData } from "@/lib/export/generate-xlsx";
import { decodeUserId } from "@/lib/auth/jwt";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return new Response("Unauthorized", { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return new Response("Invalid token", { status: 401 });

  let body: PresupuestoData & { fileName?: string };
  try {
    body = (await req.json()) as PresupuestoData & { fileName?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.obraName || !Array.isArray(body.items) || body.items.length === 0) {
    return new Response("obraName and items are required", { status: 400 });
  }

  // Optionally enrich with company name from org
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
