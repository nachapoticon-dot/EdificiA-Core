import { z } from "zod";

/** Esquemas Zod compartidos entre frontend y backend. */

export const tenantIdSchema = z.string().uuid();
export const userIdSchema = z.string().uuid();

export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const signUpSchema = loginSchema.extend({
  name: z.string().min(2, "Mínimo 2 caracteres").max(80),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
