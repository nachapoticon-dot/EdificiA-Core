"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch {
      setError("No se pudo enviar el email. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm text-center">
        <div className="text-2xl">📬</div>
        <h2 className="text-base font-semibold text-foreground">Revisá tu email</h2>
        <p className="text-sm text-muted-foreground">
          Si existe una cuenta para <strong className="text-foreground">{email}</strong>,
          recibirás un link para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-xs text-muted-foreground">
          El link expira en <strong>1 hora</strong>.
        </p>
        <Link
          href="/login"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="ingeniero@empresa.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
          {loading ? "Enviando..." : "Enviar link de recuperación"}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
