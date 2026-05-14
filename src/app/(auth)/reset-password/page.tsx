"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm text-center">
        <p className="text-sm text-destructive">
          Link inválido. Solicitá un nuevo link desde la pantalla de inicio de sesión.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm text-center">
        <div className="text-2xl">✅</div>
        <h2 className="text-base font-semibold">Contraseña actualizada</h2>
        <p className="text-sm text-muted-foreground">
          Tu contraseña fue cambiada correctamente. Podés iniciar sesión con la nueva contraseña.
        </p>
        <Button className="w-full mt-2" onClick={() => router.push("/login")}>
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
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Nueva contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Mínimo 10 caracteres"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password2" className="text-sm font-medium text-foreground">
            Confirmar contraseña
          </label>
          <input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => { setPassword2(e.target.value); setError(null); }}
            placeholder="Repetí la contraseña"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !password || !password2}
        >
          {loading ? "Actualizando..." : "Cambiar contraseña"}
        </Button>
      </div>
    </form>
  );
}
