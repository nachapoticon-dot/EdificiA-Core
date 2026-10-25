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

