"use client";

import { useState, useCallback } from "react";
import {
  Loader2, Plus, Trash2, RefreshCw, ShieldCheck, Building2,
  CheckCircle2, Clock, AlertTriangle, Users, FolderOpen,
  HardDrive, ToggleLeft, ToggleRight, CreditCard, BarChart3, Copy, KeyRound,
  UserPlus, RotateCcw, X, Ban, Link2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FounderInvitation {
  id: string;
  email: string;
  company_name: string;
  status: string;
  notes: string | null;
  created_at: string;
  expires_at: string;
  invite_token?: string | null;
}

interface CompanyStats {
  id: string;
  name: string;
  createdAt: string;
  disabled: boolean;
  subscriptionStatus: string;
  members: number;
  projects: number;
  storage: { usedBytes: number; quotaBytes: number; pct: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────────────────────────────────────

const INVITE_STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  revoked:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const INVITE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", accepted: "Aceptada", revoked: "Revocada",
};

const SUB_STATUS_STYLES: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  trial:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Activa", trial: "Trial", suspended: "Suspendida", cancelled: "Cancelada",
};

function fmtBytes(b: number): string {
  if (b < 1_048_576) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [key, setKey]               = useState("");
  const [authed, setAuthed]         = useState(false);
  const [authError, setAuthError]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [tab, setTab]               = useState<"founders" | "companies" | "stats">("founders");

  // Founders state
  const [invitations, setInvitations]   = useState<FounderInvitation[]>([]);
  const [email, setEmail]               = useState("");
  const [companyName, setCompanyName]   = useState("");
  const [notes, setNotes]               = useState("");
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState<string | null>(null);
  const [lastCreated, setLastCreated]   = useState<string | null>(null);
  const [revoking, setRevoking]         = useState<string | null>(null);
  const [resetting, setResetting]       = useState(false);
  const [resetLog, setResetLog]         = useState<string[] | null>(null);
  const [lastCreatedToken, setLastCreatedToken] = useState<string | null>(null);

  // Companies state
  const [companies, setCompanies]       = useState<CompanyStats[]>([]);
  const [toggling, setToggling]         = useState<string | null>(null);
  const [addingAdminFor, setAddingAdminFor] = useState<string | null>(null);
  const [adminEmail, setAdminEmail]     = useState("");
  const [adminRole, setAdminRole]       = useState<"admin" | "engineer" | "viewer">("admin");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminError, setAdminError]     = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  // Founders state — reactivation
  const [reactivating, setReactivating] = useState<string | null>(null);

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

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/companies", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const data = await res.json() as { companies: CompanyStats[] };
      setCompanies(data.companies);
    }
    setLoading(false);
  }, [key]);

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
    setLastCreatedToken(data.invitation?.invite_token ?? null);
    setTimeout(() => setLastCreated(null), 30_000);
    setCreating(false);
  };

  const handleReset = async () => {
    if (!confirm("⚠️ Esto borra TODOS los datos de la DB y Qdrant. ¿Continuar?")) return;
    setResetting(true);
    setResetLog(null);
    const res = await fetch("/api/super-admin/reset", { method: "POST", headers: authHeaders() });
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

  const handleToggleCompany = async (id: string, disabled: boolean) => {
    setToggling(id);
    await fetch("/api/super-admin/companies", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, disabled: !disabled }),
    });
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, disabled: !disabled } : c));
    setToggling(null);
  };

  const handleSubStatus = async (id: string, status: string) => {
    await fetch("/api/super-admin/companies", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id, subscriptionStatus: status }),
    });
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, subscriptionStatus: status } : c));
  };

  const handleAddAdmin = async (orgId: string) => {
    if (!adminEmail.trim()) return;
    setAdminSubmitting(true);
    setAdminError(null);
    const res = await fetch("/api/super-admin/members", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ orgId, email: adminEmail.trim(), role: adminRole }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    setAdminSubmitting(false);
    if (!res.ok) { setAdminError(data.error ?? "Error al enviar la invitación"); return; }
    setAdminSuccess(adminEmail.trim());
    setAdminEmail("");
    setTimeout(() => { setAdminSuccess(null); setAddingAdminFor(null); }, 4000);
  };

  const handleReactivate = async (id: string) => {
    setReactivating(id);
    const res = await fetch("/api/super-admin/founders", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const data = await res.json() as { invitation: FounderInvitation };
      setInvitations((prev) => prev.map((inv) => inv.id === id ? data.invitation : inv));
    }
    setReactivating(null);
  };

  const handleTabChange = async (t: typeof tab) => {
    setTab(t);
    // Stats tab also needs companies data
    if ((t === "companies" || t === "stats") && companies.length === 0) await fetchCompanies();
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
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

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => !c.disabled && c.subscriptionStatus !== "cancelled").length;
  const totalMembers = companies.reduce((s, c) => s + c.members, 0);

  // ── Main panel ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Super Admin · EdificIA
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Panel de gestión de la plataforma.</p>
        </div>
        <button
          onClick={() => { void fetchInvitations(key); if (tab === "companies") void fetchCompanies(); }}
          disabled={loading}
          className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
        {(["founders", "companies", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { void handleTabChange(t); }}
            className={`flex-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors capitalize ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "founders" ? "Fundadores" : t === "companies" ? "Empresas" : "Estadísticas"}
          </button>
        ))}
      </div>

      {/* ── FOUNDERS TAB ── */}
      {tab === "founders" && (
        <FoundersTab
          invitations={invitations}
          email={email} setEmail={setEmail}
          companyName={companyName} setCompanyName={setCompanyName}
          notes={notes} setNotes={setNotes}
          creating={creating} createError={createError} lastCreated={lastCreated}
          lastCreatedToken={lastCreatedToken}
          revoking={revoking}
          reactivating={reactivating}
          resetting={resetting} resetLog={resetLog}
          onCreate={handleCreate}
          onRevoke={handleRevoke}
          onReactivate={handleReactivate}
          onReset={handleReset}
        />
      )}

      {/* ── COMPANIES TAB ── */}
      {tab === "companies" && (
        <CompaniesTab
          companies={companies}
          loading={loading}
          toggling={toggling}
          addingAdminFor={addingAdminFor}
          adminEmail={adminEmail}
          adminRole={adminRole}
          adminSubmitting={adminSubmitting}
          adminError={adminError}
          adminSuccess={adminSuccess}
          onToggle={handleToggleCompany}
          onSubStatus={handleSubStatus}
          onRefresh={fetchCompanies}
          onOpenAddAdmin={(id) => { setAddingAdminFor(id); setAdminEmail(""); setAdminError(null); setAdminSuccess(null); }}
          onCloseAddAdmin={() => setAddingAdminFor(null)}
          onAdminEmailChange={setAdminEmail}
          onAdminRoleChange={setAdminRole}
          onAddAdmin={handleAddAdmin}
        />
      )}

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <StatsTab
          invitations={invitations}
          companies={companies}
          totalCompanies={totalCompanies}
          activeCompanies={activeCompanies}
          totalMembers={totalMembers}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Founders Tab
// ─────────────────────────────────────────────────────────────────────────────

function FoundersTab({
  invitations, email, setEmail, companyName, setCompanyName,
  notes, setNotes, creating, createError, lastCreated, lastCreatedToken,
  revoking, reactivating, resetting, resetLog,
  onCreate, onRevoke, onReactivate, onReset,
}: {
  invitations: FounderInvitation[];
  email: string; setEmail: (v: string) => void;
  companyName: string; setCompanyName: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  creating: boolean; createError: string | null; lastCreated: string | null; lastCreatedToken: string | null;
  revoking: string | null;
  reactivating: string | null;
  resetting: boolean; resetLog: string[] | null;
  onCreate: (e: React.FormEvent) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const pending = invitations.filter((i) => i.status === "pending");
  const rest    = invitations.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={invitations.length} label="Total invitaciones" />
        <StatCard value={pending.length} label="Pendientes" color="amber" />
        <StatCard value={invitations.filter(i => i.status === "accepted").length} label="Activadas" color="green" />
      </div>

      {/* Create form */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Activar nueva empresa
        </h2>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email del admin" type="email" value={email} onChange={setEmail} placeholder="ceo@constructora.com" required />
            <FormField label="Nombre de la empresa" value={companyName} onChange={setCompanyName} placeholder="Constructora Pérez S.A." required />
          </div>
          <FormField label="Notas internas (opcional)" value={notes} onChange={setNotes} placeholder="Contacto: Pedro, cierre previsto mayo 2026" />
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          {lastCreated && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Invitación creada para <strong>{lastCreated}</strong>
              </p>
              {lastCreatedToken && lastCreated && (
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/register?email=${encodeURIComponent(lastCreated)}&token=${lastCreatedToken}`;
                    void navigator.clipboard.writeText(url);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-left hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors w-full"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="flex-1 text-xs text-amber-800 dark:text-amber-300">Copiar link de registro para el fundador</span>
                  <Copy className="h-3.5 w-3.5 text-amber-500" />
                </button>
              )}
              <p className="text-xs text-muted-foreground">El link incluye el token de acceso. Enviáselo al fundador para que pueda registrarse.</p>
            </div>
          )}
          <button type="submit" disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Activar empresa
          </button>
        </form>
      </section>

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Clock className="h-4 w-4" /> Pendientes ({pending.length})
          </h2>
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {pending.map((inv) => <InvitationRow key={inv.id} inv={inv} onRevoke={onRevoke} onReactivate={onReactivate} revoking={revoking} reactivating={reactivating} />)}
          </div>
        </section>
      )}

      {/* History */}
      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historial</h2>
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {rest.map((inv) => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                onRevoke={onRevoke}
                onReactivate={onReactivate}
                revoking={revoking}
                reactivating={reactivating}
              />
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

      {/* Danger zone */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Reset completo</p>
              <p className="text-xs text-muted-foreground">Borra todas las tablas y la colección Qdrant. Irreversible.</p>
            </div>
          </div>
          <button onClick={() => { void onReset(); }} disabled={resetting}
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Companies Tab
// ─────────────────────────────────────────────────────────────────────────────

function CompaniesTab({
  companies, loading, toggling,
  addingAdminFor, adminEmail, adminRole, adminSubmitting, adminError, adminSuccess,
  onToggle, onSubStatus, onRefresh,
  onOpenAddAdmin, onCloseAddAdmin, onAdminEmailChange, onAdminRoleChange, onAddAdmin,
}: {
  companies: CompanyStats[];
  loading: boolean;
  toggling: string | null;
  addingAdminFor: string | null;
  adminEmail: string;
  adminRole: "admin" | "engineer" | "viewer";
  adminSubmitting: boolean;
  adminError: string | null;
  adminSuccess: string | null;
  onToggle: (id: string, disabled: boolean) => Promise<void>;
  onSubStatus: (id: string, status: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onOpenAddAdmin: (id: string) => void;
  onCloseAddAdmin: () => void;
  onAdminEmailChange: (v: string) => void;
  onAdminRoleChange: (v: "admin" | "engineer" | "viewer") => void;
  onAddAdmin: (orgId: string) => Promise<void>;
}) {
  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Sin empresas registradas</p>
        <button onClick={() => { void onRefresh(); }} className="mt-3 text-xs text-primary hover:underline">
          Cargar datos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {companies.map((company) => (
        <div key={company.id} className="rounded-xl border bg-card overflow-hidden">
          {/* Disabled banner */}
          {company.disabled && (
            <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-1.5">
              <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-xs font-medium text-destructive">Acceso deshabilitado — los usuarios de esta empresa reciben 403</span>
            </div>
          )}

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${company.disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${company.disabled ? "text-muted-foreground" : ""}`}>{company.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    desde {new Date(company.createdAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Subscription status selector */}
                <select
                  value={company.subscriptionStatus}
                  onChange={(e) => { void onSubStatus(company.id, e.target.value); }}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer bg-transparent focus:outline-none ${SUB_STATUS_STYLES[company.subscriptionStatus] ?? ""}`}
                >
                  {Object.entries(SUB_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                {/* Add member */}
                <button
                  onClick={() => addingAdminFor === company.id ? onCloseAddAdmin() : onOpenAddAdmin(company.id)}
                  title="Agregar miembro"
                  className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Agregar
                </button>

                {/* Enable/disable toggle */}
                <button
                  onClick={() => { void onToggle(company.id, company.disabled); }}
                  disabled={toggling === company.id}
                  title={company.disabled ? "Habilitar acceso" : "Deshabilitar acceso"}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-40 ${
                    company.disabled
                      ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      : "border-destructive/30 text-destructive hover:bg-destructive/10"
                  }`}
                >
                  {toggling === company.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : company.disabled
                      ? <><ToggleLeft className="h-3.5 w-3.5" /> Habilitar</>
                      : <><ToggleRight className="h-3.5 w-3.5" /> Deshabilitar</>
                  }
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat icon={Users} label="Miembros" value={company.members} />
              <MiniStat icon={FolderOpen} label="Obras" value={company.projects} />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-muted-foreground/50" />
                    <span className="font-mono text-[10px] text-muted-foreground">Storage</span>
                  </div>
                  <span className="font-mono text-[10px] font-semibold">{company.storage.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full ${company.storage.pct >= 90 ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${company.storage.pct}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-muted-foreground/60">
                  {fmtBytes(company.storage.usedBytes)} / {fmtBytes(company.storage.quotaBytes)}
                </span>
              </div>
            </div>

            {/* Add admin inline form */}
            {addingAdminFor === company.id && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" /> Invitar miembro a {company.name}
                  </p>
                  <button onClick={onCloseAddAdmin} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => onAdminEmailChange(e.target.value)}
                    placeholder="email@empresa.com"
                    className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    onKeyDown={(e) => { if (e.key === "Enter") void onAddAdmin(company.id); }}
                  />
                  <select
                    value={adminRole}
                    onChange={(e) => onAdminRoleChange(e.target.value as "admin" | "engineer" | "viewer")}
                    className="rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="admin">Admin</option>
                    <option value="engineer">Ingeniero</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => { void onAddAdmin(company.id); }}
                    disabled={adminSubmitting || !adminEmail.trim()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {adminSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Invitar
                  </button>
                </div>
                {adminError && <p className="text-xs text-destructive">{adminError}</p>}
                {adminSuccess && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Invitación enviada a <strong>{adminSuccess}</strong>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Tab
// ─────────────────────────────────────────────────────────────────────────────

function StatsTab({
  invitations, companies, totalCompanies, activeCompanies, totalMembers,
}: {
  invitations: FounderInvitation[];
  companies: CompanyStats[];
  totalCompanies: number;
  activeCompanies: number;
  totalMembers: number;
}) {
  const totalStorage = companies.reduce((s, c) => s + c.storage.usedBytes, 0);
  const totalProjects = companies.reduce((s, c) => s + c.projects, 0);
  const suspendedCount = companies.filter(c => c.subscriptionStatus === "suspended").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={totalCompanies} label="Empresas totales" />
        <StatCard value={activeCompanies} label="Empresas activas" color="green" />
        <StatCard value={totalMembers} label="Usuarios totales" color="blue" />
        <StatCard value={totalProjects} label="Obras registradas" color="purple" />
      </div>

      {suspendedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {suspendedCount} empresa{suspendedCount > 1 ? "s" : ""} con acceso suspendido.
          </p>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <HardDrive className="h-4 w-4" /> Almacenamiento total de la plataforma
        </h3>
        <p className="text-2xl font-bold tabular-nums">{fmtBytes(totalStorage)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">distribuidos en {totalCompanies} empresas</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <BarChart3 className="h-4 w-4" /> Distribución de suscripciones
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(SUB_STATUS_LABELS).map(([k, v]) => {
            const count = companies.filter(c => c.subscriptionStatus === k).length;
            return (
              <div key={k} className={`rounded-lg border p-3 text-center ${SUB_STATUS_STYLES[k] ?? ""}`}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-[10px] font-medium mt-0.5">{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <CreditCard className="h-4 w-4" /> Invitaciones
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(INVITE_STATUS_LABELS).map(([k, v]) => {
            const count = invitations.filter(i => i.status === k).length;
            return (
              <div key={k} className={`rounded-lg border p-3 text-center ${INVITE_STATUS_STYLES[k] ?? ""}`}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-[10px] font-medium mt-0.5">{v}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ value, label, color = "default" }: { value: number; label: string; color?: "default" | "amber" | "green" | "blue" | "purple" }) {
  const colorMap = {
    default: "text-foreground",
    amber:   "text-amber-600 dark:text-amber-400",
    green:   "text-emerald-600 dark:text-emerald-400",
    blue:    "text-blue-600 dark:text-blue-400",
    purple:  "text-purple-600 dark:text-purple-400",
  };
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function InvitationRow({
  inv, onRevoke, onReactivate, revoking, reactivating,
}: {
  inv: FounderInvitation;
  onRevoke: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
  revoking: string | null;
  reactivating: string | null;
}) {
  const busy = revoking === inv.id || reactivating === inv.id;
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
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
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INVITE_STATUS_STYLES[inv.status] ?? ""}`}>
            {INVITE_STATUS_LABELS[inv.status] ?? inv.status}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            Expira {new Date(inv.expires_at).toLocaleDateString("es-AR")}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Revocar — solo si está pendiente */}
          {inv.status === "pending" && (
            <button
              onClick={() => { void onRevoke(inv.id); }}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              title="Revocar invitación"
            >
              {revoking === inv.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Re-invitar — si fue revocada o ya expiró */}
          {(inv.status === "revoked" || inv.status === "accepted") && (
            <button
              onClick={() => { void onReactivate(inv.id); }}
              disabled={busy}
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
              title={inv.status === "revoked" ? "Re-activar invitación" : "Volver a invitar (nueva sesión)"}
            >
              {reactivating === inv.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RotateCcw className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {inv.status === "pending" && inv.invite_token && (
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/register?email=${encodeURIComponent(inv.email)}&token=${inv.invite_token!}`;
            void navigator.clipboard.writeText(url);
          }}
          className="ml-11 flex items-center gap-1.5 rounded-md border border-amber-300/30 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-1 text-left hover:bg-amber-100/60 dark:hover:bg-amber-950/30 transition-colors w-[calc(100%-2.75rem)]"
          title="Copiar link de registro"
        >
          <Link2 className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="flex-1 text-[10px] text-amber-700 dark:text-amber-400">Copiar link de registro</span>
          <Copy className="h-3 w-3 text-amber-500" />
        </button>
      )}
    </div>
  );
}
