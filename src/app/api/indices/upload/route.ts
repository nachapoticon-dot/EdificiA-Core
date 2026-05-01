import { decodeUserId } from "@/lib/auth/jwt";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { parsePriceListBuffer, toIndexInserts } from "@/lib/indices/upload-parser";
import { insertPriceIndices } from "@/lib/indices/query";

export const runtime = "nodejs";

/**
 * POST /api/indices/upload
 * Accepts a multipart form with:
 *   - file: Excel/CSV price list
 *   - source: 'company_list' | 'CAC' | 'INDEC'  (default: company_list)
 *   - notes: optional string
 *   - confirm: 'true' to actually insert (preview mode if absent)
 *
 * Without confirm=true  → returns { preview: ParsedPriceRow[], warnings, period }
 * With    confirm=true  → inserts all rows, returns { inserted, warnings }
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.slice(7) ?? null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Invalid token" }, { status: 401 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return Response.json({ error: "Invalid form data" }, { status: 400 }); }

  const file    = formData.get("file")    as File   | null;
  const source  = (formData.get("source")  as string | null) ?? "company_list";
  const notes   = (formData.get("notes")   as string | null) ?? undefined;
  const confirm = formData.get("confirm") === "true";

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });
  if (!["company_list", "CAC", "INDEC"].includes(source)) {
    return Response.json({ error: "Invalid source" }, { status: 400 });
  }

  try {
    const client = getInsForgeAdminClient();
    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: "No organization" }, { status: 403 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parsePriceListBuffer(buffer, file.name);

    if (!confirm) {
      // Preview mode — return what would be inserted without writing
      return Response.json({
        preview:      parsed.rows.slice(0, 50),   // cap preview at 50
        total:        parsed.rows.length,
        warnings:     parsed.warnings,
        period_year:  parsed.period_year,
        period_month: parsed.period_month,
      });
    }

    // Confirm mode — insert
    if (parsed.rows.length === 0) {
      return Response.json({ error: "No valid rows found", warnings: parsed.warnings }, { status: 422 });
    }

    const inserts = toIndexInserts(parsed, {
      organizationId: orgId,
      source: source as "company_list" | "CAC" | "INDEC",
      uploadedBy: userId,
      sourceFile: file.name,
      notes,
    });

    const inserted = await insertPriceIndices(inserts);
    return Response.json({ inserted, warnings: parsed.warnings, period_year: parsed.period_year, period_month: parsed.period_month }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/indices/upload]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
