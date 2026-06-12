"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

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
      <div className="space-y-3 p-5 text-center sm:p-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-medium text-foreground">Revisá tu email</h2>
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
    <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5 sm:p-6">
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          Ingresá tu email y te enviaremos un link para restablecer tu contraseña.
        </p>

        <Field>
          <FieldLabel htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Email
          </FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="ingeniero@empresa.com"
            className="h-10 rounded-[8px] bg-background/80"
            required
          />
        </Field>

        {error && (
          <Alert variant="destructive" className="rounded-[8px]">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="h-10 w-full rounded-[8px]" disabled={loading || !email.trim()}>
          {loading && <Spinner />}
          {loading ? "Enviando..." : "Enviar link de recuperación"}
        </Button>
      </FieldGroup>

      <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
