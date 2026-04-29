import { z } from "zod";

/** Esquemas Zod compartidos entre frontend y backend. */

export const tenantIdSchema = z.string().uuid();
export const userIdSchema = z.string().uuid();

export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
