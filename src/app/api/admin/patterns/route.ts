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
