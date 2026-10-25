import pino, { type Logger } from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: { service: "edificia" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const httpLogger = logger.child({ module: "http" });
export const aiLogger   = logger.child({ module: "ai" });
export const ragLogger  = logger.child({ module: "rag" });
export const dbLogger   = logger.child({ module: "db" });

export const REQUEST_ID_HEADER = "x-request-id";

/** Child logger con el `x-request-id` que agrega `proxy.ts`, si está presente. */
export function getRequestLogger(req: Request | Headers, base: Logger = logger): Logger {
  const headers = req instanceof Headers ? req : req.headers;
  const requestId = headers.get(REQUEST_ID_HEADER);
  return requestId ? base.child({ requestId }) : base;
}
