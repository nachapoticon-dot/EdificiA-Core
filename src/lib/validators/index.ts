import { z } from "zod";

/** Esquemas Zod compartidos entre frontend y backend. */

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const signUpSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string()
    .min(10, "Mínimo 10 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[0-9]/, "Debe incluir al menos un número"),
  name: z.string().min(2, "Mínimo 2 caracteres").max(80),
  confirmPassword: z.string(),
  inviteToken: z.string().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export * from "./api-responses";
