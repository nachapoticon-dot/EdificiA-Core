import { z } from "zod";

/** Ítem individual de un presupuesto de obra. */
export const budgetItemSchema = z.object({
  code: z.string().describe("Código o rubro del ítem (ej. 'SC01', 'A-001')"),
  description: z.string().describe("Descripción del trabajo o material"),
  unit: z.string().describe("Unidad de medida (ej. 'm2', 'kg', 'gl')"),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative().describe("Precio unitario sin impuestos"),
  totalPrice: z
    .number()
    .nonnegative()
    .describe("Total declarado en el presupuesto"),
  isSubcontracted: z
    .boolean()
    .default(false)
    .describe("true si el ítem es ejecutado por un subcontratista externo"),
  hasInternalLabor: z
    .boolean()
    .default(false)
    .describe("true si el ítem incluye mano de obra propia de la empresa"),
});

export type BudgetItem = z.infer<typeof budgetItemSchema>;

/** Presupuesto completo de una obra. */
export const budgetSchema = z.object({
  projectName: z.string(),
  items: z.array(budgetItemSchema),
  directCostTotal: z.number().nonnegative(),
});

export type Budget = z.infer<typeof budgetSchema>;

// ── Tool input schemas (usados por el agente de IA) ──────────────────────────

export const calcularTotalesInputSchema = z.object({
  items: z.array(budgetItemSchema).describe("Ítems del presupuesto a calcular"),
  declaredTotal: z
    .number()
    .optional()
    .describe("Total declarado para comparación (opcional)"),
});

export const validarCierreInputSchema = z.object({
  items: z.array(budgetItemSchema),
  declaredTotal: z
    .number()
    .describe("Total declarado en el presupuesto a auditar"),
  tolerancePct: z
    .number()
    .min(0)
    .max(0.1)
    .optional()
    .describe("Tolerancia máxima de desvío (default 0.5% = 0.005)"),
});

export const detectarExclusionesInputSchema = z.object({
  items: z.array(budgetItemSchema),
});

export const calcularIncidenciaInputSchema = z.object({
  items: z.array(budgetItemSchema),
  subgroupCodes: z
    .array(z.string())
    .describe("Códigos de los ítems del subgrupo a analizar"),
  grandTotal: z.number().describe("Total general del proyecto"),
});
