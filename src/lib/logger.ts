import pino from "pino";

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
