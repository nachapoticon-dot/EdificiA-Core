import { z } from "zod";

/** Ítem individual de un presupuesto de obra. */
export const budgetItemSchema = z.object({
  code: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  isSubcontracted: z.boolean().default(false),
  hasInternalLabor: z.boolean().default(false),
});

export type BudgetItem = z.infer<typeof budgetItemSchema>;

/** Presupuesto completo de una obra. */
export const budgetSchema = z.object({
  projectName: z.string(),
  items: z.array(budgetItemSchema),
  directCostTotal: z.number().nonnegative(),
});

export type Budget = z.infer<typeof budgetSchema>;
