import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

interface PatternRow {
  document_type: string;
  pattern_key: string;
  pattern_value: unknown;
  sample_count: number;
  updated_at: string;
}

export async function GET(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();

  const memberResult = await client.database
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id;
  if (!orgId) return Response.json({ error: "Org not found" }, { status: 404 });

  const result = await client.database
    .from("company_learned_patterns")
    .select("document_type, pattern_key, pattern_value, sample_count, updated_at")
    .eq("organization_id", orgId)
    .order("document_type", { ascending: true })
    .order("pattern_key", { ascending: true });

  const rows = (result.data ?? []) as PatternRow[];

  // Group by document_type
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

/** POST /api/admin/patterns — promote a pattern to industry_benchmarks (cross-company learning) */
export async function POST(req: Request): Promise<Response> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();
  const memberResult = await client.database
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  const member = memberResult.data as { organization_id: string; role: string } | null;
  if (!member) return Response.json({ error: "Org not found" }, { status: 404 });
  if (member.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { documentType?: string; patternKey?: string };
  if (!body.documentType || !body.patternKey) {
    return Response.json({ error: "documentType and patternKey son requeridos" }, { status: 400 });
  }

  // Fetch the pattern to promote
  const patternResult = await client.database
    .from("company_learned_patterns")
    .select("pattern_value, sample_count")
    .eq("organization_id", member.organization_id)
    .eq("document_type", body.documentType)
    .eq("pattern_key", body.patternKey)
    .limit(1)
    .single();

  const pattern = patternResult.data as { pattern_value: unknown; sample_count: number } | null;
  if (!pattern) return Response.json({ error: "Patrón no encontrado" }, { status: 404 });

  // Map document type to industry category
  const categoryMap: Record<string, string> = {
    excel: "general", pdf: "general", dxf: "civil", docx: "general",
  };
  const category = categoryMap[body.documentType] ?? "general";

  // Upsert into industry_benchmarks (anonymized — no org reference stored)
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
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const userId = decodeUserId(token);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const client = getInsForgeAdminClient();

  const memberResult = await client.database
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .single();

  const member = memberResult.data as { organization_id: string; role: string } | null;
  if (!member) return Response.json({ error: "Org not found" }, { status: 404 });
  if (member.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { documentType?: string; patternKey?: string };
  if (!body.documentType || !body.patternKey) {
    return Response.json({ error: "documentType and patternKey are required" }, { status: 400 });
  }

  await client.database
    .from("company_learned_patterns")
    .delete()
    .eq("organization_id", member.organization_id)
    .eq("document_type", body.documentType)
    .eq("pattern_key", body.patternKey);

  return Response.json({ ok: true });
}
