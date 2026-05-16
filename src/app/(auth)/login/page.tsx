"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getInsForgeClient, persistAuthToken } from "@/lib/insforge/client";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

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
    <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5 sm:p-6">
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-[6px] border border-primary/20 bg-primary/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
          <ShieldCheck className="h-3 w-3" />
          Acceso privado
        </div>
        <h2 className="font-display text-[28px] font-normal leading-tight text-foreground">
          Entrar a EdificIA
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Continuá el trabajo de tus obras con el contexto, los documentos y el historial de tu equipo.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/55" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="nombre@constructora.com"
              className="w-full rounded-[8px] border border-input bg-background/80 px-3 py-2.5 pl-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive"
              aria-invalid={!!errors.email}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Contraseña
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/55" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full rounded-[8px] border border-input bg-background/80 px-3 py-2.5 pl-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive"
              aria-invalid={!!errors.password}
            />
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-[8px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" className="h-10 w-full gap-2 rounded-[8px]" disabled={loading}>
          {loading ? "Ingresando..." : "Entrar al panel"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
        ¿Primera vez?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Activar cuenta
        </Link>
      </p>
    </form>
  );
}
