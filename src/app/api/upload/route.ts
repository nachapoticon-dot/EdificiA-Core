import { parseExcelBudget } from "@/lib/excel/parser";
import { getInsForgeAdminClient } from "@/lib/insforge/server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "presupuestos";

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

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
    return Response.json(
      { error: "Formato no soportado. Subí un archivo .xlsx, .xls o .csv." },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const parsed = parseExcelBudget(buffer, file.name);

  if (parsed.items.length === 0) {
    return Response.json(
      { error: "No se encontraron ítems válidos en el archivo. Verificá que tenga la estructura de presupuesto correcta." },
      { status: 422 },
    );
  }

  // Persist to InsForge storage + DB (best-effort — don't block on failure)
  let storagePath: string | null = null;
  let fileId: string | null = null;

  try {
    const client = getInsForgeAdminClient();
    const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });

    const storageResult = await client.storage
      .from(STORAGE_BUCKET)
      .upload(`${Date.now()}_${file.name}`, blob);

    if (storageResult.data) {
      storagePath = storageResult.data.key ?? null;
    }

    const dbResult = await client.database
      .from("uploaded_files")
      .insert({
        file_name: file.name,
        file_type: ext === "xlsx" || ext === "xls" ? "excel" : "other",
        storage_path: storagePath ?? `local/${file.name}`,
        file_size_bytes: file.size,
        processing_status: "ready",
      })
      .select("id")
      .single();

    if (dbResult.data) {
      fileId = (dbResult.data as { id: string }).id;
    }
  } catch {
    // Non-fatal: we still return the parsed data even if persistence fails
  }

  return Response.json({
    fileName: parsed.fileName,
    sheetName: parsed.sheetName,
    itemCount: parsed.items.length,
    detectedTotal: parsed.detectedTotal,
    items: parsed.items,
    fileId,
    storagePath,
  });
}
