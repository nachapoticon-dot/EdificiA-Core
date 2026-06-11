import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DbError, StorageBucket } from "@/lib/db/types";

/**
 * StorageAdapter de filesystem local (reemplazo de InsForge Storage).
 * Misma superficie y envolturas { data, error } que el SDK.
 * Raíz: STORAGE_DIR (default ./data/storage), un subdirectorio por bucket.
 * Al migrar a otra infraestructura se escribe un adapter S3 con esta interfaz.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".dxf": "image/vnd.dxf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_DIR ?? "./data/storage");
}

function toError(err: unknown): DbError {
  const e = err as { message?: string; code?: string };
  return { message: e?.message ?? String(err), code: e?.code };
}

class FsBucket implements StorageBucket {
  private readonly bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  /** Resuelve la ruta absoluta de una key, rechazando escapes del bucket (.. , rutas absolutas). */
  private resolveSafe(key: string): string {
    const bucketDir = path.join(storageRoot(), this.bucket);
    const normalized = path.normalize(key).replace(/^([/\\])+/, "");
    const full = path.resolve(bucketDir, normalized);
    if (!full.startsWith(bucketDir + path.sep) && full !== bucketDir) {
      throw new Error(`Storage key inválida: "${key}"`);
    }
    return full;
  }

  async upload(key: string, blob: Blob): Promise<{ data: { key: string } | null; error: DbError | null }> {
    try {
      const full = this.resolveSafe(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, Buffer.from(await blob.arrayBuffer()));
      // data.key es lo que la app persiste como uploaded_files.storage_path
      return { data: { key }, error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  async download(storagePath: string): Promise<{ data: Blob | null; error: DbError | null }> {
    try {
      const full = this.resolveSafe(storagePath);
      const buffer = await readFile(full);
      const mime = MIME_BY_EXT[path.extname(full).toLowerCase()] ?? "application/octet-stream";
      return { data: new Blob([new Uint8Array(buffer)], { type: mime }), error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }

  async remove(paths: string[]): Promise<{ data: unknown; error: DbError | null }> {
    try {
      for (const p of paths) {
        await unlink(this.resolveSafe(p)).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") throw err; // borrar algo ya borrado no es error
        });
      }
      return { data: { removed: paths }, error: null };
    } catch (err) {
      return { data: null, error: toError(err) };
    }
  }
}

export function getFsStorage(): { from(bucket: string): StorageBucket } {
  return { from: (bucket: string) => new FsBucket(bucket) };
}
