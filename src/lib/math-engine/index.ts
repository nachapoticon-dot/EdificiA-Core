/**
 * Motor de Auditoría Dinámico y Agnóstico.
 * Implementa las reglas de negocio de docs/03_domain_knowledge.md.
 *
 * El motor NO impone fórmulas rígidas. Aprende el estilo de cada empresa
 * a través del contexto que el agente acumula en cada sesión.
 */

export * from "./validators";
export * from "./calculator";
export * from "./auditor";
