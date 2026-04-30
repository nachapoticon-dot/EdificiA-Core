import { processFile } from "@/lib/file-processor";
import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { extractPatterns } from "@/lib/pattern-extractor";
import { ingestDocument } from "@/lib/rag/ingest";

export const runtime = "nodejs";

const STORAGE_BUCKET = "presupuestos";

const ACCEPTED_EXTENSIONS = [
  ".xlsx", ".xls", ".csv",
  ".pdf",
  ".dxf",
  ".docx", ".doc",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
];

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Formato de request inválido." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return Response.json(
      { error: `Formato "${ext}" no soportado.`, supported: ACCEPTED_EXTENSIONS.join(", ") },
      { status: 400 },
    );
  }

  // Decode auth early — needed to populate uploaded_by + organization_id
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const userId = accessToken ? decodeUserId(accessToken) : null;

  // Get org membership (best-effort — upload still works without it for local dev)
  let orgId: string | null = null;
  if (userId) {
    try {
      const client = getInsForgeAdminClient();
      const memberResult = await client.database
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(1)
        .single();
      orgId = (memberResult.data as { organization_id: string } | null)?.organization_id ?? null;
    } catch {
      // Non-fatal
    }
  }

  const buffer = await file.arrayBuffer();
  const processed = await processFile(buffer, file.name, file.type || undefined);

  if (processed.type === "dwg_unsupported") {
    return Response.json({ error: processed.message, suggestion: processed.suggestion }, { status: 422 });
  }

  // Persist to InsForge storage + DB (best-effort)
  let fileId: string | null = null;
  try {
    const client = getInsForgeAdminClient();
    const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });

    const storageResult = await client.storage
      .from(STORAGE_BUCKET)
      .upload(`${Date.now()}_${file.name}`, blob);

    const storagePath = storageResult.data?.key ?? `local/${file.name}`;

    const fileTypeForDb =
      processed.type === "excel" ? "excel"
      : processed.type === "pdf" ? "pdf"
      : processed.type === "image" ? "image"
      : "other";

    // Only insert if we have the required NOT NULL fields
    if (orgId && userId) {
      const dbResult = await client.database
        .from("uploaded_files")
        .insert({
          organization_id: orgId,
          uploaded_by: userId,
          file_name: file.name,
          file_type: fileTypeForDb,
          storage_path: storagePath,
          file_size_bytes: file.size,
          processing_status: "ready",
        })
        .select("id")
        .single();

      if (dbResult.data) {
        fileId = (dbResult.data as { id: string }).id;
      }
    }
  } catch {
    // Non-fatal
  }

  // Patterns + RAG ingest (best-effort, non-fatal)
  if (orgId) {
    void persistPatternsAndIngest(processed, userId, orgId, fileId);
  }

  return Response.json({ ...processed, fileId });
}

/** Decodes user ID from JWT payload without signature verification. */
function decodeUserId(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as { sub?: string };
    return parsed.sub ?? null;
  } catch {
    return null;
  }
}

async function persistPatternsAndIngest(
  processed: Awaited<ReturnType<typeof processFile>>,
  userId: string | null,
  orgId: string,
  fileId: string | null,
): Promise<void> {
  try {
    // Ingest into RAG (Qdrant + document_chunks)
    void ingestDocument(processed, { organizationId: orgId, fileId });

    // Pattern extraction + upsert
    const extracted = extractPatterns(processed);
    if (!extracted) return;

    const client = getInsForgeAdminClient();
    for (const [key, value] of Object.entries(extracted.patterns)) {
      await client.database
        .from("company_learned_patterns")
        .upsert({
          organization_id: orgId,
          document_type: extracted.documentType,
          pattern_key: key,
          pattern_value: value,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,document_type,pattern_key" });
    }
  } catch {
    // Non-fatal
  }
}
