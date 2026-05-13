import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { getQdrantClient, isQdrantConfigured } from "@/lib/qdrant/client";

export const runtime = "nodejs";

type ServiceStatus = {
  status: "ok" | "error" | "unconfigured";
  latencyMs?: number;
  detail?: string;
};

export async function GET() {
  const [postgres, qdrant] = await Promise.all([checkPostgres(), checkQdrant()]);

  const healthy = postgres.status === "ok" && qdrant.status !== "error";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      services: { postgres, qdrant },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}

async function checkPostgres(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    const { error } = await getInsForgeAdminClient()
      .database.from("uploaded_files")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t, detail: String(e) };
  }
}

async function checkQdrant(): Promise<ServiceStatus> {
  if (!isQdrantConfigured()) return { status: "unconfigured", detail: "QDRANT_URL not set" };
  const t = Date.now();
  try {
    await getQdrantClient().getCollections();
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t, detail: String(e) };
  }
}
