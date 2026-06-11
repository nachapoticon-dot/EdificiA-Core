import { z } from "zod";

/**
 * Contrato único de variables de entorno.
 *
 * Las "requeridas" hacen fallar el arranque del servidor (fail-fast) si faltan o
 * están mal formadas — en lugar de degradar en silencio a auth roto o fetch a una
 * URL vacía en runtime. La validación se dispara al boot desde `src/instrumentation.ts`.
 *
 * Las "opcionales" degradan funcionalidad (embeddings, vector store, email, cron)
 * pero no rompen el arranque; cada módulo consumidor ya chequea su disponibilidad.
 */
const envSchema = z
  .object({
  // --- Requeridas: la app no funciona sin estas ---
  DEEPSEEK_API_KEY: z.string().min(1, "es requerida (API key de DeepSeek)"),

  // --- Backend de datos ---
  // "postgres" = infraestructura propia (Postgres + auth local + storage FS).
  // ausente/otro = InsForge legacy (en desuso, se elimina al completar la desconexión).
  DATA_BACKEND: z.enum(["postgres", "insforge"]).optional(),
  DATABASE_URL: z.string().optional(), // requerida cuando DATA_BACKEND=postgres
  AUTH_JWT_SECRET: z.string().optional(), // requerida cuando DATA_BACKEND=postgres (≥32 chars)
  STORAGE_DIR: z.string().optional(), // raíz del storage filesystem (default ./data/storage)
  NEXT_PUBLIC_INSFORGE_URL: z.string().url().optional(), // legacy, requerida solo sin DATA_BACKEND=postgres
  INSFORGE_SERVICE_ROLE_KEY: z.string().optional(), // legacy, requerida solo sin DATA_BACKEND=postgres

  // --- Opcionales: degradan funcionalidad, no rompen el boot ---
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(), // embeddings RAG
  RESEND_API_KEY: z.string().optional(), // email
  RESEND_FROM_EMAIL: z.string().optional(),
  SUPER_ADMIN_KEY: z.string().optional(), // panel super-admin
  PASSWORD_RESET_SECRET: z.string().optional(), // cae a service role key
  CRON_SECRET: z.string().optional(), // cae a super admin key
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_MODEL_FAST: z.string().optional(),
  AI_MODEL_DEEP: z.string().optional(),
  AUTH_STRICT_MODE: z.enum(["true", "false"]).optional(),
  })
  .superRefine((vals, ctx) => {
    if (vals.DATA_BACKEND === "postgres") {
      if (!vals.DATABASE_URL) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "es requerida con DATA_BACKEND=postgres" });
      }
      if (!vals.AUTH_JWT_SECRET || vals.AUTH_JWT_SECRET.length < 32) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["AUTH_JWT_SECRET"], message: "es requerida con DATA_BACKEND=postgres (mínimo 32 caracteres)" });
      }
    } else {
      if (!vals.NEXT_PUBLIC_INSFORGE_URL) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["NEXT_PUBLIC_INSFORGE_URL"], message: "es requerida en modo InsForge (o seteá DATA_BACKEND=postgres)" });
      }
      if (!vals.INSFORGE_SERVICE_ROLE_KEY) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["INSFORGE_SERVICE_ROLE_KEY"], message: "es requerida en modo InsForge (o seteá DATA_BACKEND=postgres)" });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Decide si corresponde validar de forma estricta (y por ende lanzar al faltar algo).
 * No validamos en el cliente, durante el build, en tests, ni cuando se saltea explícito.
 */
function shouldValidate(): boolean {
  if (typeof window !== "undefined") return false; // nunca en el bundle del cliente
  if (process.env.SKIP_ENV_VALIDATION === "true") return false; // break-glass explícito
  if (process.env.NEXT_PHASE === "phase-production-build") return false; // no romper el build
  if (process.env.NODE_ENV === "test") return false;
  return true;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && shouldValidate()) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(
    `Variables de entorno inválidas o faltantes:\n${issues}\n\n` +
      `Revisá tu .env.local (ver .env.local.example). ` +
      `Para saltar esta validación temporalmente: SKIP_ENV_VALIDATION=true.`,
  );
}

/**
 * Si la validación se saltea (build / cliente / test), exponemos los valores crudos
 * tipados para que el código compile y no crashee en esos contextos.
 */
export const env: Env = (parsed.success ? parsed.data : (process.env as unknown)) as Env;
