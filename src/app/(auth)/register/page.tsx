"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { getInsForgeClient, persistAuthToken } from "@/lib/insforge/client";
import { signUpSchema, loginSchema, type SignUpInput } from "@/lib/validators";
import { apiErrorResponseSchema, okResponseSchema, registerInvitationCheckResponseSchema } from "@/lib/validators/api-responses";

type Step = "check" | "complete";
type FieldErrors = Partial<Record<keyof SignUpInput, string>>;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const tokenParam = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>("check");
  const [email, setEmail] = useState(emailParam);
  const [inviteToken] = useState(tokenParam);
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState<Omit<SignUpInput, "email">>({ name: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-verify when email+token come from a magic link
  useEffect(() => {
    if (!emailParam || !tokenParam) return;
    void (async () => {
      const res = await fetch(
        `/api/auth/register?email=${encodeURIComponent(emailParam)}&token=${encodeURIComponent(tokenParam)}`,
      );
      const parsed = registerInvitationCheckResponseSchema.safeParse(await res.json());
      if (parsed.success && parsed.data.authorized) {
        setOrgName(parsed.data.organizationName);
        setStep("complete");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setServerError(null);
  }

  async function handleCheckEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const emailParsed = loginSchema.shape.email.safeParse(trimmed);
    if (!emailParsed.success) {
      setErrors({ email: emailParsed.error.issues[0]?.message ?? "Email inválido" });
      return;
    }

    setLoading(true);
    setServerError(null);
    try {
      const tokenQuery = inviteToken ? `&token=${encodeURIComponent(inviteToken)}` : "";
      const res = await fetch(`/api/auth/register?email=${encodeURIComponent(trimmed)}${tokenQuery}`);
      const data: unknown = await res.json();

      if (!res.ok) {
        const error = apiErrorResponseSchema.safeParse(data);
        setServerError(error.success ? error.data.error : "No se pudo verificar el email. Intentá de nuevo.");
        return;
      }

      const parsed = registerInvitationCheckResponseSchema.safeParse(data);
      if (!parsed.success || !parsed.data.authorized) {
        setServerError("Tu email no está autorizado. Solicitá una invitación al administrador de tu empresa.");
        return;
      }

      setOrgName(parsed.data.organizationName);
      setStep("complete");
    } catch {
      setServerError("No se pudo verificar el email. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ email, ...form, ...(inviteToken ? { inviteToken } : {}) });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignUpInput;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data: unknown = await res.json();

      if (res.status === 409) {
        setServerError("__already_exists__");
        return;
      }
      const ok = okResponseSchema.safeParse(data);
      if (!res.ok || !ok.success) {
        const error = apiErrorResponseSchema.safeParse(data);
        setServerError(error.success ? error.data.error : "Error al crear la cuenta.");
        return;
      }

      // Auto sign-in via server endpoint to set httpOnly cookie
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
      });

      if (!loginRes.ok) {
        setServerError("Cuenta creada. Por favor iniciá sesión.");
        router.push("/login");
        return;
      }

      const loginData = await loginRes.json() as { accessToken?: string; refreshToken?: string | null };
      if (loginData.accessToken) {
        persistAuthToken(loginData.accessToken, loginData.refreshToken ?? undefined);
        getInsForgeClient().getHttpClient().setAuthToken(loginData.accessToken);
      }

      router.push("/dashboard/chat");
      router.refresh();
    } catch {
      setServerError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {step === "check" ? (
        <form onSubmit={handleCheckEmail} noValidate>
          <FieldGroup className="gap-4">
            <p className="text-xs text-muted-foreground">
              El acceso es por invitación. Ingresá tu email corporativo para verificar si tenés una invitación activa.
            </p>

            <Field data-invalid={!!errors.email || undefined}>
              <FieldLabel htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Email corporativo
              </FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors({}); setServerError(null); }}
                placeholder="ingeniero@empresa.com"
                className="h-10 rounded-[8px] bg-background/80"
                aria-invalid={!!errors.email}
              />
              <FieldError className="text-xs">{errors.email}</FieldError>
            </Field>

            {serverError && (
              <Alert variant="destructive" className="rounded-[8px]">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="h-10 w-full rounded-[8px]" disabled={loading || !email.trim()}>
              {loading && <Spinner />}
              {loading ? "Verificando..." : "Verificar invitación"}
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={handleRegister} noValidate>
          <FieldGroup className="gap-4">
            <div className="rounded-[8px] border border-primary/20 bg-primary/[0.06] px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
              Invitación verificada · {orgName}
            </div>

            <Field>
              <FieldLabel className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Email
              </FieldLabel>
              <Input type="email" value={email} disabled className="h-10 rounded-[8px]" />
            </Field>

            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Nombre completo
              </FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleFieldChange}
                placeholder="Juan García"
                className="h-10 rounded-[8px] bg-background/80"
                aria-invalid={!!errors.name}
              />
              <FieldError className="text-xs">{errors.name}</FieldError>
            </Field>

            <Field data-invalid={!!errors.password || undefined}>
              <FieldLabel htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Contraseña
              </FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleFieldChange}
                placeholder="Mínimo 10 caracteres, 1 mayúscula, 1 número"
                className="h-10 rounded-[8px] bg-background/80"
                aria-invalid={!!errors.password}
              />
              <FieldError className="text-xs">{errors.password}</FieldError>
            </Field>

            <Field data-invalid={!!errors.confirmPassword || undefined}>
              <FieldLabel htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Confirmar contraseña
              </FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleFieldChange}
                placeholder="Repetí tu contraseña"
                className="h-10 rounded-[8px] bg-background/80"
                aria-invalid={!!errors.confirmPassword}
              />
              <FieldError className="text-xs">{errors.confirmPassword}</FieldError>
            </Field>

            {serverError && serverError !== "__already_exists__" && (
              <Alert variant="destructive" className="rounded-[8px]">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            {serverError === "__already_exists__" && (
              <Alert className="rounded-[8px] border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTitle>Tu cuenta ya existe.</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  <Link href="/login" className="font-medium underline hover:text-amber-900 dark:hover:text-amber-200">
                    Iniciá sesión
                  </Link>
                  {" "}— tu empresa se activará automáticamente al ingresar.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="h-10 w-full rounded-[8px]" disabled={loading || serverError === "__already_exists__"}>
              {loading && <Spinner />}
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>

            <button
              type="button"
              onClick={() => { setStep("check"); setErrors({}); setServerError(null); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Cambiar email
            </button>
          </FieldGroup>
        </form>
      )}

      <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
