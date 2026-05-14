import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { requireAuth } from "@/lib/auth/require-auth";

export const runtime = "nodejs";

interface SaveRequest {
  fileName: string;
  content: string;
  contentType: string;
}

/**
 * Endpoint for confirmed AI-generated files.
 * Called only after the user explicitly approves a DocumentProposalCard.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fileName, content, contentType } = body;
  if (!fileName || !content) {
    return Response.json({ error: "fileName and content are required" }, { status: 400 });
  }

  try {
    const client = getInsForgeAdminClient();

    const buffer = Buffer.from(
      content.startsWith("data:")
        ? content.split(",")[1] ?? content
        : content,
      "base64",
    );

    const storagePath = `edificia_generated/${auth.orgId}/${Date.now()}_${fileName}`;
    const blob = new Blob([buffer], { type: contentType });

    const storageResult = await client.storage
      .from("presupuestos")
      .upload(storagePath, blob);

    const path = storageResult.data?.key ?? storagePath;

    await client.database.from("document_chunks").insert({
      organization_id: auth.orgId,
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
