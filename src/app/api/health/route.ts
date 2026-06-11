import { getInsForgeAdminClient } from "@/lib/insforge/server";
import { sqlQuery } from "@/lib/db/sql";
import { httpLogger } from "@/lib/logger";

export const runtime = "nodejs";

type ServiceStatus = {
  status: "ok" | "error" | "unconfigured";
  latencyMs?: number;
  detail?: string;
};

export async function GET() {
  const t0 = Date.now();
  const [postgres, vector] = await Promise.all([checkPostgres(), checkPgVector()]);

  const healthy = postgres.status === "ok" && vector.status !== "error";
  const payload = {
    status: healthy ? "ok" : "degraded",
    services: { postgres, vector },
    timestamp: new Date().toISOString(),
  };

  httpLogger.info({ ...payload, latencyMs: Date.now() - t0 }, "health check");

  return Response.json(payload, { status: healthy ? 200 : 503 });
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

async function checkPgVector(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    const rows = await sqlQuery<{ extname: string }>("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    if (rows.length === 0) return { status: "unconfigured", detail: "extensión pgvector no instalada" };
    return { status: "ok", latencyMs: Date.now() - t };
  } catch (e) {
    return { status: "error", latencyMs: Date.now() - t, detail: String(e) };
  }
}
