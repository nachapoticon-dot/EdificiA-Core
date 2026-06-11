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
const envSchema = z.object({
  // --- Requeridas: la app no funciona sin estas ---
  NEXT_PUBLIC_INSFORGE_URL: z.string().url("debe ser una URL válida (ej. https://xxx.insforge.app)"),
  INSFORGE_SERVICE_ROLE_KEY: z.string().min(1, "es requerida (service role key de InsForge)"),
  DEEPSEEK_API_KEY: z.string().min(1, "es requerida (API key de DeepSeek)"),

  // --- Opcionales: degradan funcionalidad, no rompen el boot ---
  DATABASE_URL: z.string().optional(), // Postgres propio (requerida cuando DATA_BACKEND=postgres)
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(), // embeddings RAG
  QDRANT_URL: z.string().url().optional(), // vector store
  QDRANT_API_KEY: z.string().optional(),
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
