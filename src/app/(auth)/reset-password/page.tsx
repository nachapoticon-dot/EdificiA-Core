"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  if (!token) {
    return (
      <div className="space-y-3 p-5 text-center sm:p-6">
        <Alert variant="destructive" className="rounded-[8px] text-left">
          <AlertDescription>
            Link inválido. Solicitá un nuevo link desde la pantalla de inicio de sesión.
          </AlertDescription>
        </Alert>
        <Link href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 p-5 text-center sm:p-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-medium text-foreground">Contraseña actualizada</h2>
        <p className="text-sm text-muted-foreground">
          Tu contraseña fue cambiada correctamente. Podés iniciar sesión con la nueva contraseña.
        </p>
        <Button className="mt-2 h-10 w-full rounded-[8px]" onClick={() => router.push("/login")}>
          Ir al inicio de sesión
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo actualizar la contraseña.");
        return;
      }
      setDone(true);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5 sm:p-6">
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        <Field>
          <FieldLabel htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Nueva contraseña
          </FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Mínimo 10 caracteres"
            className="h-10 rounded-[8px] bg-background/80"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password2" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Confirmar contraseña
          </FieldLabel>
          <Input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => { setPassword2(e.target.value); setError(null); }}
            placeholder="Repetí la contraseña"
            className="h-10 rounded-[8px] bg-background/80"
            required
          />
        </Field>

        {error && (
          <Alert variant="destructive" className="rounded-[8px]">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="h-10 w-full rounded-[8px]"
          disabled={loading || !password || !password2}
        >
          {loading && <Spinner />}
          {loading ? "Actualizando..." : "Cambiar contraseña"}
        </Button>
      </FieldGroup>
    </form>
  );
}
