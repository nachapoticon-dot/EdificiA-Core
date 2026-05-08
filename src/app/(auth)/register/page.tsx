"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getInsForgeClient, persistAuthToken } from "@/lib/insforge/client";
import { signUpSchema, loginSchema, type SignUpInput } from "@/lib/validators";

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
  const [step, setStep] = useState<Step>("check");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState<Omit<SignUpInput, "email">>({ name: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`/api/auth/register?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json() as { authorized?: boolean; organizationName?: string; error?: string };

      if (!data.authorized) {
        setServerError("Tu email no está autorizado. Solicitá una invitación al administrador de tu empresa.");
        return;
      }

      setOrgName(data.organizationName ?? "tu empresa");
      setStep("complete");
    } catch {
      setServerError("No se pudo verificar el email. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ email, ...form });
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
      const data = await res.json() as { ok?: boolean; error?: string };

      if (res.status === 409) {
        setServerError("__already_exists__");
        return;
      }
      if (!res.ok || !data.ok) {
        setServerError(data.error ?? "Error al crear la cuenta.");
        return;
      }

      // Auto sign-in after successful registration
      const { error: signInErr } = await getInsForgeClient().auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (signInErr) {
        setServerError("Cuenta creada. Por favor iniciá sesión.");
        router.push("/login");
        return;
      }

      const rawToken = getInsForgeClient().getHttpClient().getHeaders().Authorization as string | undefined;
      if (rawToken) {
        persistAuthToken(rawToken.replace(/^Bearer\s+/i, ""));
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
    <div className="space-y-4">
      {step === "check" ? (
        <form onSubmit={handleCheckEmail} noValidate className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs text-muted-foreground">
              El acceso es por invitación. Ingresá tu email corporativo para verificar si tenés una invitación activa.
            </p>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email corporativo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors({}); setServerError(null); }}
                placeholder="ingeniero@empresa.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {serverError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? "Verificando..." : "Verificar invitación"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleRegister} noValidate className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary font-medium">
              Invitación verificada · {orgName}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium text-foreground">Nombre completo</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleFieldChange}
                placeholder="Juan García"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleFieldChange}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirmar contraseña</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleFieldChange}
                placeholder="Repetí tu contraseña"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive"
                aria-invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            {serverError && serverError !== "__already_exists__" && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>
            )}
            {serverError === "__already_exists__" && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">Tu cuenta ya existe.</p>
                <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                  <Link href="/login" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200">
                    Iniciá sesión
                  </Link>
                  {" "}— tu empresa se activará automáticamente al ingresar.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || serverError === "__already_exists__"}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>

            <button
              type="button"
              onClick={() => { setStep("check"); setErrors({}); setServerError(null); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Cambiar email
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
