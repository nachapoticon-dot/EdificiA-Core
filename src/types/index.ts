/** Tipos compartidos de dominio. Expandir a medida que se definen los modelos. */

export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export interface Tenant {
  id: TenantId;
  name: string;
  createdAt: Date;
}

export interface User {
  id: UserId;
  tenantId: TenantId;
  email: string;
  role: "admin" | "engineer" | "viewer";
}
