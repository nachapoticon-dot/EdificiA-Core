/**
 * Hook de arranque de Next.js. Se ejecuta una vez cuando inicia el servidor.
 * Importar `@/lib/env` acá dispara la validación de variables de entorno al boot:
 * si falta una requerida, el servidor falla con un error claro en vez de degradar
 * en silencio en runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
