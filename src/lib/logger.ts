import pino, { type Logger } from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev && {
    transport: {
      target: "pino/file",
      options: { destination: 1 }, // stdout with pretty-print via NODE_OPTIONS or plain JSON
    },
  }),
  base: { service: "edificia" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const httpLogger = logger.child({ module: "http" });
export const authLogger = logger.child({ module: "auth" });
export const aiLogger   = logger.child({ module: "ai" });
export const ragLogger  = logger.child({ module: "rag" });
export const dbLogger   = logger.child({ module: "db" });

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Devuelve un child logger con `requestId` extraído del header `x-request-id`.
 * El middleware (`proxy.ts`) garantiza que el header esté presente en cualquier
 * request que pase por la matriz de matchers. Si no hay header (test, llamada
 * directa interna), se devuelve el base logger sin contexto.
 */
export function getRequestLogger(req: Request | Headers, base: Logger = logger): Logger {
  const headers = req instanceof Headers ? req : req.headers;
  const requestId = headers.get(REQUEST_ID_HEADER);
  return requestId ? base.child({ requestId }) : base;
}
