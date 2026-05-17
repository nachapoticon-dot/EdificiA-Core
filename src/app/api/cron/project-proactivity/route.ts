import { runDailyProjectScan } from "@/lib/proactivity/daily-scan";
import { getRequestLogger, httpLogger } from "@/lib/logger";
import { dailyProjectScanResponseSchema } from "@/lib/validators/api-responses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const log = getRequestLogger(req, httpLogger);
  if (!isAuthorizedCronRequest(req)) {
    log.warn("unauthorized project proactivity cron request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readOptionalJson(req);
    const limit = parseLimit(body?.limit);
    const result = await runDailyProjectScan({ limit });

    return Response.json(dailyProjectScanResponseSchema.parse(result));
  } catch (err) {
    log.error({ err }, "project proactivity cron failed");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.SUPER_ADMIN_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const headerSecret = req.headers.get("x-cron-secret");

  return bearer === secret || headerSecret === secret;
}

async function readOptionalJson(req: Request): Promise<{ limit?: unknown } | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  const value = await req.json();
  return typeof value === "object" && value !== null ? value : null;
}

function parseLimit(value: unknown): number | undefined {
  if (value == null) return undefined;
  const limit = typeof value === "number" ? value : Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : undefined;
}
