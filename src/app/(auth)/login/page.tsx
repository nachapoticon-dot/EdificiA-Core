"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getInsForgeClient, persistAuthToken } from "@/lib/insforge/client";
import { loginSchema, type LoginInput } from "@/lib/validators";

interface LoginApiResponse {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string | null;
  error?: string;
}

type FieldErrors = Partial<Record<keyof LoginInput, string>>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setServerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LoginInput;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
      });
    } catch {
      setLoading(false);
      setServerError("Error de conexión. Verificá tu red e intentá de nuevo.");
      return;
    }

    const loginData = await res.json() as LoginApiResponse;
    setLoading(false);

    if (!res.ok || !loginData.accessToken) {
      setServerError(loginData.error ?? "Email o contraseña incorrectos.");
      return;
    }

    // Persist token in localStorage so the browser SDK stays authenticated
    persistAuthToken(loginData.accessToken, loginData.refreshToken ?? undefined);
    // Also set the token on the singleton SDK client so it can be used immediately
    getInsForgeClient().getHttpClient().setAuthToken(loginData.accessToken);

    // Reclamar org de fundador / invitación de miembro si hay alguna pendiente.
    // El email se extrae del JWT en el servidor — no hay que mandarlo.
    // Si alguna falla NO bloqueamos el login, pero sí logueamos para diagnóstico.
    const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${loginData.accessToken}` };
    const [founderRes, inviteRes] = await Promise.all([
      fetch("/api/auth/claim-founder", { method: "POST", headers: authHeaders, body: "{}" }),
      fetch("/api/auth/claim-invitation", { method: "POST", headers: authHeaders, body: "{}" }),
    ]);

    if (!founderRes.ok) {
      const body = await founderRes.json().catch(() => ({}));
      console.error("[login] claim-founder falló:", founderRes.status, body);
    }
    if (!inviteRes.ok) {
      const body = await inviteRes.json().catch(() => ({}));
      console.error("[login] claim-invitation falló:", inviteRes.status, body);
    }

    const next = (searchParams.get("next") ?? "/dashboard/chat") as never;
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="ingeniero@empresa.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Contraseña
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        ¿Primera vez?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
