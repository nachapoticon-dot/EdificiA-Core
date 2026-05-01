import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { decodeUserId } from "@/lib/auth/jwt";

export const runtime = "nodejs";

interface SaveRequest {
  fileName: string;
  content: string;         // base64 or text content
  contentType: string;     // 'text/plain' | 'application/json' | etc.
  organizationId: string;
}

/**
 * Endpoint for confirmed AI-generated files.
 * Called only after the user explicitly approves a DocumentProposalCard.
 * Uploads to InsForge storage with generated_by: "edificia" metadata.
 */
export async function POST(req: Request) {
  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fileName, content, contentType, organizationId } = body;
  if (!fileName || !content || !organizationId) {
    return Response.json({ error: "fileName, content, and organizationId are required" }, { status: 400 });
  }

  // Decode JWT to verify user belongs to the org
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = decodeUserId(accessToken);
  if (!userId) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const client = getInsForgeAdminClient();

    // Verify membership
    const memberResult = await client.database
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .limit(1)
      .single();

    if (!memberResult.data) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Convert content to buffer
    const buffer = Buffer.from(
      content.startsWith("data:")
        ? content.split(",")[1] ?? content
        : content,
      "base64",
    );

    const storagePath = `edificia_generated/${organizationId}/${Date.now()}_${fileName}`;
    const blob = new Blob([buffer], { type: contentType });

    const storageResult = await client.storage
      .from("presupuestos")
      .upload(storagePath, blob);

    const path = storageResult.data?.key ?? storagePath;

    // Record in document_chunks with generated_by tag
    await client.database.from("document_chunks").insert({
      organization_id: organizationId,
      file_id: null,
      file_name: fileName,
      document_type: "generated",
      chunk_index: 0,
      chunk_text: `Archivo generado por EdificIA: ${fileName}`,
      metadata: { storagePath: path, contentType },
      generated_by: "edificia",
    });

    return Response.json({ success: true, path });
  } catch (err) {
    console.error("[documents/save]", err);
    return Response.json({ error: "Error saving file" }, { status: 500 });
  }
}
