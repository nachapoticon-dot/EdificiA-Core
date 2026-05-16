import { requireAuth } from "@/lib/auth/require-auth";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { parsePriceListBuffer, toIndexInserts } from "@/lib/indices/upload-parser";
import { insertPriceIndices } from "@/lib/indices/query";
import { dbLogger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/indices/upload
 * Accepts a multipart form with:
 *   - file: Excel/CSV price list
 *   - source: 'company_list' | 'CAC' | 'INDEC'  (default: company_list)
 *   - notes: optional string
 *   - confirm: 'true' to actually insert (preview mode if absent)
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

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
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parsePriceListBuffer(buffer, file.name);

    if (!confirm) {
      return Response.json({
        preview:      parsed.rows.slice(0, 50),
        total:        parsed.rows.length,
        warnings:     parsed.warnings,
        period_year:  parsed.period_year,
        period_month: parsed.period_month,
      });
    }

    if (parsed.rows.length === 0) {
      return Response.json({ error: "No valid rows found", warnings: parsed.warnings }, { status: 422 });
    }

    const inserts = toIndexInserts(parsed, {
      organizationId: auth.orgId,
      source: source as "company_list" | "CAC" | "INDEC",
      uploadedBy: auth.userId,
      sourceFile: file.name,
      notes,
    });

    const inserted = await insertPriceIndices(inserts);
    return Response.json(
      { inserted, warnings: parsed.warnings, period_year: parsed.period_year, period_month: parsed.period_month },
      { status: 201 },
    );
  } catch (err) {
    dbLogger.error({ err }, "POST /api/indices/upload");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
