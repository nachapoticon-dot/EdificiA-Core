import { processFile } from "@/lib/file-processor";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

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
      {
        error: `Formato "${ext}" no soportado.`,
        supported: ACCEPTED_EXTENSIONS.join(", "),
      },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const processed = await processFile(buffer, file.name, file.type || undefined);

  // DWG: return early with the guidance message
  if (processed.type === "dwg_unsupported") {
    return Response.json({ error: processed.message, suggestion: processed.suggestion }, { status: 422 });
  }

  // Persist to InsForge (best-effort)
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

    const dbResult = await client.database
      .from("uploaded_files")
      .insert({
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
  } catch {
    // Non-fatal
  }

  return Response.json({ ...processed, fileId });
}
