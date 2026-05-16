import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

interface PatternRow {
  document_type: string;
  pattern_key: string;
  pattern_value: unknown;
  sample_count: number;
  updated_at: string;
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const client = getInsForgeAdminClient();
  const result = await client.database
    .from("company_learned_patterns")
    .select("document_type, pattern_key, pattern_value, sample_count, updated_at")
    .eq("organization_id", auth.orgId)
    .order("document_type", { ascending: true })
    .order("pattern_key", { ascending: true });

  const rows = (result.data ?? []) as PatternRow[];

  const grouped: Record<string, { patterns: PatternRow[]; maxSampleCount: number }> = {};
  for (const row of rows) {
    if (!grouped[row.document_type]) {
      grouped[row.document_type] = { patterns: [], maxSampleCount: 0 };
    }
    grouped[row.document_type]!.patterns.push(row);
    grouped[row.document_type]!.maxSampleCount = Math.max(
      grouped[row.document_type]!.maxSampleCount,
      row.sample_count,
    );
  }

  return Response.json({ grouped, totalPatterns: rows.length });
}

/** POST — promote a pattern to industry_benchmarks */
export async function POST(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { documentType?: string; patternKey?: string };
  if (!body.documentType || !body.patternKey) {
    return Response.json({ error: "documentType and patternKey son requeridos" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();

  const patternResult = await client.database
    .from("company_learned_patterns")
    .select("pattern_value, sample_count")
    .eq("organization_id", auth.orgId)
    .eq("document_type", body.documentType)
    .eq("pattern_key", body.patternKey)
    .limit(1)
    .single();

  const pattern = patternResult.data as { pattern_value: unknown; sample_count: number } | null;
  if (!pattern) return Response.json({ error: "Patrón no encontrado" }, { status: 404 });

  const categoryMap: Record<string, string> = {
    excel: "general", pdf: "general", dxf: "civil", docx: "general",
  };
  const category = categoryMap[body.documentType] ?? "general";

  await client.database
    .from("industry_benchmarks")
    .upsert({
      document_type: body.documentType,
      category,
      benchmark_key: body.patternKey,
      benchmark_value: pattern.pattern_value,
      org_count: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "document_type,category,benchmark_key" });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireAuth(req, { role: "admin" });
  if (auth instanceof Response) return auth;

  const body = (await req.json()) as { documentType?: string; patternKey?: string };
  if (!body.documentType || !body.patternKey) {
    return Response.json({ error: "documentType and patternKey are required" }, { status: 400 });
  }

  const client = getInsForgeAdminClient();
  await client.database
    .from("company_learned_patterns")
    .delete()
    .eq("organization_id", auth.orgId)
    .eq("document_type", body.documentType)
    .eq("pattern_key", body.patternKey);

  return Response.json({ ok: true });
}
