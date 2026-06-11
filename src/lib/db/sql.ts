import { getPool } from "./pool";

/**
 * Escape hatch para SQL crudo parametrizado (pgvector, agregaciones, etc.)
 * donde el query-builder compatible queda corto. A diferencia del builder,
 * acá los errores SÍ lanzan: el caller decide cómo manejarlos.
 */
export async function sqlQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
