"use client";

import { useState, useCallback } from "react";
import { Loader2, Plus, Trash2, RefreshCw, ShieldCheck, Building2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface FounderInvitation {
  id: string;
  email: string;
  company_name: string;
  status: string;
  notes: string | null;
  created_at: string;
  expires_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  revoked:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending:  "Pendiente",
  accepted: "Aceptada",
  revoked:  "Revocada",
};

export default function SuperAdminPage() {
  const [key, setKey]                 = useState("");
  const [authed, setAuthed]           = useState(false);
  const [authError, setAuthError]     = useState(false);
  const [invitations, setInvitations] = useState<FounderInvitation[]>([]);
  const [loading, setLoading]         = useState(false);
  const [email, setEmail]             = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes]             = useState("");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);
  const [revoking, setRevoking]       = useState<string | null>(null);
  const [resetting, setResetting]     = useState(false);
  const [resetLog, setResetLog]       = useState<string[] | null>(null);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  }), [key]);

  const fetchInvitations = useCallback(async (k: string) => {
    setLoading(true);
    const res = await fetch("/api/super-admin/founders", {
      headers: { Authorization: `Bearer ${k}` },
    });
    if (!res.ok) { setAuthError(true); setLoading(false); return; }
    const data = await res.json() as { invitations: FounderInvitation[] };
    setInvitations(data.invitations);
    setAuthed(true);
    setLoading(false);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(false);
    await fetchInvitations(key);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !companyName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/super-admin/founders", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email: email.trim(), company_name: companyName.trim(), notes: notes.trim() || undefined }),
    });
    const data = await res.json() as { invitation?: FounderInvitation; error?: string };
    if (!res.ok) { setCreateError(data.error ?? "Error al crear"); setCreating(false); return; }
    setInvitations((prev) => [data.invitation!, ...prev]);
    setEmail(""); setCompanyName(""); setNotes("");
    setLastCreated(email.trim());
    setTimeout(() => setLastCreated(null), 4000);
    setCreating(false);
  };

  const handleReset = async () => {
    if (!confirm("⚠️ Esto borra TODOS los datos de la DB y Qdrant. ¿Continuar?")) return;
    setResetting(true);
    setResetLog(null);
    const res = await fetch("/api/super-admin/reset", {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json() as { ok?: boolean; log?: string[] };
    setResetLog(data.log ?? []);
    setInvitations([]);
    setResetting(false);
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    await fetch(`/api/super-admin/founders?id=${id}`, { method: "DELETE", headers: authHeaders() });
    setInvitations((prev) => prev.map((inv) => inv.id === id ? { ...inv, status: "revoked" } : inv));
    setRevoking(null);
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Super Admin · EdificIA
          </div>
          <form onSubmit={handleAuth} className="space-y-3 rounded-xl border bg-card p-5">
            <div className="space-y-1">
              <label className="text-sm font-medium">Clave de acceso</label>
              <input
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setAuthError(false); }}
                placeholder="SUPER_ADMIN_KEY"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              {authError && <p className="text-xs text-destructive">Clave incorrecta.</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !key}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pending  = invitations.filter((i) => i.status === "pending");
  const rest     = invitations.filter((i) => i.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Super Admin · Fundadores
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activá emails para que puedan crear su empresa en EdificIA.
          </p>
        </div>
        <button
          onClick={() => { void fetchInvitations(key); }}
          disabled={loading}
          className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Reset zona de peligro */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Reset completo</p>
              <p className="text-xs text-muted-foreground">Borra todas las tablas y la colección Qdrant. Irreversible.</p>
            </div>
          </div>
          <button
            onClick={() => { void handleReset(); }}
            disabled={resetting}
            className="flex items-center gap-2 rounded-lg border border-destructive/50 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {resetting ? "Borrando…" : "Resetear todo"}
          </button>
        </div>
        {resetLog && (
          <pre className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
            {resetLog.join("\n")}
          </pre>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{invitations.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total invitaciones</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pendientes</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">
            {invitations.filter((i) => i.status === "accepted").length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Activadas</p>
        </div>
      </div>

      {/* Create form */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          Activar nueva empresa
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email del admin</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@constructora.com"
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre de la empresa</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Constructora Pérez S.A."
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas internas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contacto: Pedro, cierre previsto mayo 2026"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          {lastCreated && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Invitación creada para <strong>{lastCreated}</strong>
            </p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Activar empresa
          </button>
        </form>
      </section>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Clock className="h-4 w-4" />
            Pendientes ({pending.length})
          </h2>
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {pending.map((inv) => (
              <InvitationRow key={inv.id} inv={inv} onRevoke={handleRevoke} revoking={revoking} />
            ))}
          </div>
        </section>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historial</h2>
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {rest.map((inv) => (
              <InvitationRow key={inv.id} inv={inv} onRevoke={handleRevoke} revoking={revoking} />
            ))}
          </div>
        </section>
      )}

      {invitations.length === 0 && (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Sin invitaciones todavía</p>
          <p className="text-xs text-muted-foreground mt-1">Activá la primera empresa usando el formulario de arriba.</p>
        </div>
      )}
    </div>
  );
}

function InvitationRow({
  inv,
  onRevoke,
  revoking,
}: {
  inv: FounderInvitation;
  onRevoke: (id: string) => Promise<void>;
  revoking: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inv.email}</p>
        <p className="text-xs text-muted-foreground truncate">
          {inv.company_name}{inv.notes ? ` · ${inv.notes}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status] ?? ""}`}>
          {STATUS_LABELS[inv.status] ?? inv.status}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          Expira {new Date(inv.expires_at).toLocaleDateString("es-AR")}
        </p>
      </div>
      {inv.status === "pending" && (
        <button
          onClick={() => { void onRevoke(inv.id); }}
          disabled={revoking === inv.id}
          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
          title="Revocar invitación"
        >
          {revoking === inv.id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
