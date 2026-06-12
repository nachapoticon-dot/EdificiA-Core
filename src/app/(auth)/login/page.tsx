"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { getInsForgeClient, persistAuthToken } from "@/lib/insforge/client";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

interface LoginApiResponse {
  ok?: boolean;
  accessToken?: string;
  refreshToken?: string | null;
  error?: string;
  code?: "no_invitation" | "invitation_pending";
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
  const [serverErrorCode, setServerErrorCode] = useState<LoginApiResponse["code"] | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setServerError(null);
    setServerErrorCode(null);
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
      setServerErrorCode(loginData.code ?? null);
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

      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.email || undefined}>
          <FieldLabel
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            Email
          </FieldLabel>
          <InputGroup className="h-10 rounded-[8px] bg-background/80 shadow-sm">
            <InputGroupAddon>
              <Mail className="text-muted-foreground/55" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="nombre@constructora.com"
              aria-invalid={!!errors.email}
            />
          </InputGroup>
          <FieldError className="text-xs">{errors.email}</FieldError>
        </Field>

        <Field data-invalid={!!errors.password || undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Contraseña
            </FieldLabel>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <InputGroup className="h-10 rounded-[8px] bg-background/80 shadow-sm">
            <InputGroupAddon>
              <LockKeyhole className="text-muted-foreground/55" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••••••"
              aria-invalid={!!errors.password}
            />
          </InputGroup>
          <FieldError className="text-xs">{errors.password}</FieldError>
        </Field>

        {serverError && (
          <Alert variant="destructive" className="rounded-[8px]">
            <AlertDescription>
              {serverError}
              {serverErrorCode === "invitation_pending" && (
                <Link href="/register" className="mt-1 block font-medium underline underline-offset-2">
                  Ir a activar mi cuenta →
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-10 w-full gap-2 rounded-[8px]" disabled={loading}>
          {loading && <Spinner />}
          {loading ? "Ingresando..." : "Entrar al panel"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </FieldGroup>

      <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
        ¿Primera vez?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Activar cuenta
        </Link>
      </p>
    </form>
  );
}
