"use client";

import { useState, useCallback } from "react";
import {
  Loader2, Plus, Trash2, RefreshCw, ShieldCheck, Building2,
  CheckCircle2, Clock, AlertTriangle, Users, FolderOpen,
  HardDrive, ToggleLeft, ToggleRight, CreditCard, BarChart3, Copy, KeyRound,
  UserPlus, RotateCcw, X, Ban, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  apiErrorResponseSchema,
  superAdminCompaniesResponseSchema,
  superAdminFounderResponseSchema,
  superAdminFoundersResponseSchema,
  superAdminMemberInviteResponseSchema,
  superAdminResetResponseSchema,
  type SuperAdminCompanyStats,
  type SuperAdminFounderInvitation,
} from "@/lib/validators/api-responses";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type FounderInvitation = SuperAdminFounderInvitation;
type CompanyStats = SuperAdminCompanyStats;

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

const TAB_CONFIG = {
  founders: { label: "Fundadores", icon: KeyRound },
  companies: { label: "Empresas", icon: Building2 },
  stats: { label: "Estadísticas", icon: BarChart3 },
} as const;

const PANEL = "rounded-[8px] border border-border bg-card shadow-[var(--shadow-sm)]";
const TECH_LABEL = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";
const FIELD_CLASS = "w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15";
const ICON_BUTTON = "flex h-9 w-9 items-center justify-center rounded-[8px] border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";

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
    const parsed = superAdminFoundersResponseSchema.safeParse(await res.json());
    if (!parsed.success) { setAuthError(true); setLoading(false); return; }
    setInvitations(parsed.data.invitations);
    setAuthed(true);
    setLoading(false);
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/companies", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const parsed = superAdminCompaniesResponseSchema.safeParse(await res.json());
      if (parsed.success) setCompanies(parsed.data.companies);
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
    const data: unknown = await res.json();
    if (!res.ok) {
      const error = apiErrorResponseSchema.safeParse(data);
      setCreateError(error.success ? error.data.error : "Error al crear");
      setCreating(false);
      return;
    }
    const parsed = superAdminFounderResponseSchema.safeParse(data);
    if (!parsed.success) { setCreateError("Respuesta inválida del servidor"); setCreating(false); return; }
    setInvitations((prev) => [parsed.data.invitation, ...prev]);
    setEmail(""); setCompanyName(""); setNotes("");
    setLastCreated(email.trim());
    setLastCreatedToken(parsed.data.invitation.invite_token ?? null);
    setTimeout(() => setLastCreated(null), 30_000);
    setCreating(false);
  };

  const handleReset = async () => {
    if (!confirm("⚠️ Esto borra TODOS los datos de la DB y Qdrant. ¿Continuar?")) return;
    setResetting(true);
    setResetLog(null);
    const res = await fetch("/api/super-admin/reset", { method: "POST", headers: authHeaders() });
    const parsed = superAdminResetResponseSchema.safeParse(await res.json());
    setResetLog(parsed.success ? parsed.data.log : []);
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
    const data: unknown = await res.json();
    setAdminSubmitting(false);
    if (!res.ok) {
      const error = apiErrorResponseSchema.safeParse(data);
      setAdminError(error.success ? error.data.error : "Error al enviar la invitación");
      return;
    }
    const parsed = superAdminMemberInviteResponseSchema.safeParse(data);
    if (!parsed.success) { setAdminError("Respuesta inválida del servidor"); return; }
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
      const parsed = superAdminFounderResponseSchema.safeParse(await res.json());
      if (parsed.success) {
        setInvitations((prev) => prev.map((inv) => inv.id === id ? parsed.data.invitation : inv));
      }
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
      <div className="relative min-h-screen overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 text-[var(--ed-grid)]">
          <div className="eb-grid-texture absolute inset-0 opacity-55" />
        </div>
        <main className="relative flex min-h-screen items-center justify-center px-5 py-8">
          <div className="w-full max-w-5xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary text-primary-foreground shadow-[var(--shadow-sm)]">
                  <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">EdificIA Super Admin</p>
                  <p className={TECH_LABEL}>Root console</p>
                </div>
              </div>
              <span className="hidden rounded-[6px] border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">
                Acceso privado
              </span>
            </div>

            <div className={cn(PANEL, "overflow-hidden")}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
                <section className="border-b border-border bg-card/70 p-5 sm:p-6 lg:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className={TECH_LABEL}>Operación central</p>
                      <h1 className="mt-2 text-[22px] font-semibold tracking-normal text-foreground">
                        Control de tenants, accesos y estado comercial.
                      </h1>
                    </div>
                    <KeyRound className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <LoginSignal icon={Building2} label="TENANTS" value="RLS" />
                    <LoginSignal icon={Users} label="ROLES" value="Admin" />
                    <LoginSignal icon={HardDrive} label="CUOTAS" value="Storage" />
                  </div>

                  <div className="mt-6 rounded-[8px] border border-border bg-background p-3">
                    <p className={TECH_LABEL}>Superficie crítica</p>
                    <div className="mt-3 space-y-2 text-[12px] text-muted-foreground">
                      <ConsoleLine label="founders" value="altas de empresas y tokens de fundador" />
                      <ConsoleLine label="companies" value="habilitación, suscripción y miembros" />
                      <ConsoleLine label="reset" value="operación destructiva con confirmación explícita" tone="danger" />
                    </div>
                  </div>
                </section>

                <section className="p-5 sm:p-6">
                  <form onSubmit={handleAuth}>
                    <div>
                      <p className={TECH_LABEL}>Autenticación</p>
                      <h2 className="mt-2 text-[18px] font-semibold text-foreground">Ingresar clave raíz</h2>
                      <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">
                        No hay onboarding ni branding público en esta pantalla. Es una consola operativa cerrada.
                      </p>
                    </div>

                    <div className="mt-5 space-y-1.5">
                      <label className={TECH_LABEL}>SUPER_ADMIN_KEY</label>
                      <input
                        type="password"
                        value={key}
                        onChange={(e) => { setKey(e.target.value); setAuthError(false); }}
                        placeholder="Clave local o de producción"
                        className={FIELD_CLASS}
                        autoFocus
                      />
                      {authError && <p className="text-[12px] text-destructive">Clave incorrecta.</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !key}
                      className="mt-5 flex h-10 w-full items-center justify-center rounded-[8px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Abrir consola"}
                    </button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter((c) => !c.disabled && c.subscriptionStatus !== "cancelled").length;
  const totalMembers = companies.reduce((s, c) => s + c.members, 0);

  // ── Main panel ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 text-[var(--ed-grid)]">
        <div className="eb-grid-texture absolute inset-0 opacity-60" />
      </div>
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-5 sm:px-8 sm:py-7">
      {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary text-primary-foreground shadow-[var(--shadow-sm)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className={TECH_LABEL}>EdificIA · Root Console</p>
              <h1 className="font-display text-[26px] font-medium leading-tight tracking-normal text-foreground">
                Super Admin
              </h1>
            </div>
        </div>
        <button
          onClick={() => { void fetchInvitations(key); if (tab === "companies") void fetchCompanies(); }}
          disabled={loading}
            className={ICON_BUTTON}
            title="Actualizar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        </header>

      {/* Tabs */}
        <nav className="grid grid-cols-3 gap-1 rounded-[8px] border border-border bg-card p-1 shadow-[var(--shadow-xs)]">
        {(["founders", "companies", "stats"] as const).map((t) => (
            (() => {
              const Icon = TAB_CONFIG[t].icon;
              return (
          <button
            key={t}
            onClick={() => { void handleTabChange(t); }}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-2 rounded-[6px] px-3 text-[12px] font-semibold transition-colors",
                    tab === t ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
          >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {TAB_CONFIG[t].label}
          </button>
              );
            })()
        ))}
        </nav>

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard value={invitations.length} label="Total invitaciones" />
        <StatCard value={pending.length} label="Pendientes" color="amber" />
        <StatCard value={invitations.filter(i => i.status === "accepted").length} label="Activadas" color="green" />
      </div>

      {/* Create form */}
      <section className={cn(PANEL, "p-4 sm:p-5")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className={TECH_LABEL}>Founder onboarding</p>
            <h2 className="mt-1 flex items-center gap-2 text-[16px] font-semibold text-foreground">
              <Plus className="h-4 w-4 text-primary" /> Activar nueva empresa
            </h2>
          </div>
        </div>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                  className="flex w-full items-center gap-2 rounded-[8px] border border-[oklch(0.82_0.14_70)] bg-[oklch(0.98_0.04_75)] px-3 py-2 text-left transition-colors hover:bg-[oklch(0.96_0.06_75)] dark:bg-amber-950/30 dark:hover:bg-amber-950/40"
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
            className="flex h-10 items-center gap-2 rounded-[8px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
          <div className={cn(PANEL, "divide-y divide-border overflow-hidden")}>
            {pending.map((inv) => <InvitationRow key={inv.id} inv={inv} onRevoke={onRevoke} onReactivate={onReactivate} revoking={revoking} reactivating={reactivating} />)}
          </div>
        </section>
      )}

      {/* History */}
      {rest.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historial</h2>
          <div className={cn(PANEL, "divide-y divide-border overflow-hidden")}>
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
        <div className={cn(PANEL, "p-10 text-center")}>
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Sin invitaciones todavía</p>
          <p className="text-xs text-muted-foreground mt-1">Activá la primera empresa usando el formulario de arriba.</p>
        </div>
      )}

      {/* Danger zone */}
      <section className="rounded-[8px] border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Reset completo</p>
              <p className="text-xs text-muted-foreground">Borra todas las tablas y la colección Qdrant. Irreversible.</p>
            </div>
          </div>
          <button onClick={() => { void onReset(); }} disabled={resetting}
            className="flex shrink-0 items-center gap-2 rounded-[8px] border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {resetting ? "Borrando…" : "Resetear todo"}
          </button>
        </div>
        {resetLog && (
          <pre className="mt-3 max-h-40 overflow-y-auto rounded-[8px] bg-background p-3 text-xs text-muted-foreground">
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
      <div className={cn(PANEL, "flex items-center justify-center py-20 text-muted-foreground")}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className={cn(PANEL, "p-10 text-center")}>
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium">Sin empresas registradas</p>
        <button onClick={() => { void onRefresh(); }} className="mt-3 text-xs text-primary hover:underline">
          Cargar datos
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {companies.map((company) => (
        <div key={company.id} className={cn(PANEL, "overflow-hidden")}>
          {/* Disabled banner */}
          {company.disabled && (
            <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-1.5">
              <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-xs font-medium text-destructive">Acceso deshabilitado — los usuarios de esta empresa reciben 403</span>
            </div>
          )}

          <div className="p-4 sm:p-5">
            {/* Header row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] ${company.disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${company.disabled ? "text-muted-foreground" : ""}`}>{company.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    desde {new Date(company.createdAt).toLocaleDateString("es-AR")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {/* Subscription status selector */}
                <select
                  value={company.subscriptionStatus}
                  onChange={(e) => { void onSubStatus(company.id, e.target.value); }}
                  className={`cursor-pointer rounded-[6px] border px-2.5 py-1 text-xs font-medium bg-transparent focus:outline-none ${SUB_STATUS_STYLES[company.subscriptionStatus] ?? ""}`}
                >
                  {Object.entries(SUB_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                {/* Add member */}
                <button
                  onClick={() => addingAdminFor === company.id ? onCloseAddAdmin() : onOpenAddAdmin(company.id)}
                  title="Agregar miembro"
                  className="flex items-center gap-1 rounded-[6px] border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MiniStat icon={Users} label="Miembros" value={company.members} />
              <MiniStat icon={FolderOpen} label="Obras" value={company.projects} />
              <div className="rounded-[6px] bg-background px-3 py-2">
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
              <div className="mt-4 space-y-3 rounded-[8px] border border-primary/20 bg-primary/[0.04] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" /> Invitar miembro a {company.name}
                  </p>
                  <button onClick={onCloseAddAdmin} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_132px_auto]">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => onAdminEmailChange(e.target.value)}
                    placeholder="email@empresa.com"
                    className={FIELD_CLASS}
                    onKeyDown={(e) => { if (e.key === "Enter") void onAddAdmin(company.id); }}
                  />
                  <select
                    value={adminRole}
                    onChange={(e) => onAdminRoleChange(e.target.value as "admin" | "engineer" | "viewer")}
                    className={FIELD_CLASS}
                  >
                    <option value="admin">Admin</option>
                    <option value="engineer">Ingeniero</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => { void onAddAdmin(company.id); }}
                    disabled={adminSubmitting || !adminEmail.trim()}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
  const totalQuota = companies.reduce((s, c) => s + c.storage.quotaBytes, 0);
  const totalProjects = companies.reduce((s, c) => s + c.projects, 0);
  const suspendedCount = companies.filter(c => c.subscriptionStatus === "suspended").length;
  const disabledCount = companies.filter(c => c.disabled).length;
  const pendingInvitations = invitations.filter(i => i.status === "pending").length;
  const acceptedInvitations = invitations.filter(i => i.status === "accepted").length;
  const storagePct = totalQuota > 0 ? Math.round((totalStorage / totalQuota) * 100) : 0;
  const topStorage = [...companies]
    .sort((a, b) => b.storage.usedBytes - a.storage.usedBytes)
    .slice(0, 6);
  const statusRows = Object.entries(SUB_STATUS_LABELS).map(([key, label]) => {
    const count = companies.filter(c => c.subscriptionStatus === key).length;
    return { key, label, count, pct: totalCompanies > 0 ? Math.round((count / totalCompanies) * 100) : 0 };
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetric label="Empresas" value={totalCompanies} sub={`${activeCompanies} activas · ${disabledCount} deshabilitadas`} />
        <ExecutiveMetric label="Usuarios" value={totalMembers} sub={`${totalCompanies > 0 ? (totalMembers / totalCompanies).toFixed(1) : "0"} por empresa`} />
        <ExecutiveMetric label="Obras" value={totalProjects} sub={`${totalCompanies > 0 ? (totalProjects / totalCompanies).toFixed(1) : "0"} por empresa`} />
        <ExecutiveMetric label="Invitaciones" value={pendingInvitations} sub={`${acceptedInvitations} activadas`} tone={pendingInvitations > 0 ? "warning" : "neutral"} />
      </div>

      {suspendedCount > 0 && (
        <div className="flex items-center gap-3 rounded-[8px] border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {suspendedCount} empresa{suspendedCount > 1 ? "s" : ""} con acceso suspendido.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className={cn(PANEL, "p-5")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={TECH_LABEL}>Capacidad</p>
              <h3 className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
                <HardDrive className="h-4 w-4 text-primary" /> Almacenamiento por tenants
              </h3>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">{storagePct}% usado</span>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[30px] font-semibold leading-none tabular-nums text-foreground">{fmtBytes(totalStorage)}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">de {fmtBytes(totalQuota)} asignados</p>
              </div>
              <p className="text-right text-[12px] text-muted-foreground">{totalCompanies} empresas</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full rounded-full", storagePct >= 90 ? "bg-destructive" : storagePct >= 70 ? "bg-[var(--warn)]" : "bg-primary")}
                style={{ width: `${Math.min(100, storagePct)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {topStorage.length === 0 ? (
              <p className="rounded-[6px] border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                Sin datos de empresas para rankear almacenamiento.
              </p>
            ) : topStorage.map((company) => (
              <TenantUsageRow key={company.id} company={company} />
            ))}
          </div>
        </section>

        <section className={cn(PANEL, "p-5")}>
          <p className={TECH_LABEL}>Estado comercial</p>
          <h3 className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" /> Suscripciones
          </h3>
          <div className="mt-5 divide-y divide-border rounded-[8px] border border-border">
            {statusRows.map((row) => (
              <DistributionRow key={row.key} label={row.label} count={row.count} pct={row.pct} />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CompactStat label="Pendientes" value={pendingInvitations} />
            <CompactStat label="Aceptadas" value={acceptedInvitations} />
            <CompactStat label="Revocadas" value={invitations.filter(i => i.status === "revoked").length} />
          </div>
        </section>
      </div>

      <section className={cn(PANEL, "overflow-hidden")}>
        <div className="border-b border-border px-5 py-4">
          <p className={TECH_LABEL}>Salud de tenants</p>
          <h3 className="mt-1 text-[15px] font-semibold text-foreground">Resumen operativo por empresa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">Empresa</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">Estado</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em]">Miembros</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.12em]">Obras</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em]">Storage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.slice(0, 10).map((company) => (
                <tr key={company.id} className="bg-card">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{company.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{new Date(company.createdAt).toLocaleDateString("es-AR")}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-[6px] px-2 py-1 text-[11px] font-medium", company.disabled ? "bg-destructive/10 text-destructive" : SUB_STATUS_STYLES[company.subscriptionStatus])}>
                      {company.disabled ? "Deshabilitada" : SUB_STATUS_LABELS[company.subscriptionStatus] ?? company.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{company.members}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{company.projects}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                        <div
                          className={cn("h-full rounded-full", company.storage.pct >= 90 ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${company.storage.pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">{company.storage.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Sin empresas cargadas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LoginSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-background/70 p-3">
      <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ConsoleLine({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-destructive" : "bg-primary")} />
      <p className="min-w-0">
        <span className="font-mono text-[11px] text-foreground">{label}</span>
        <span className="text-muted-foreground"> · {value}</span>
      </p>
    </div>
  );
}

function ExecutiveMetric({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className={cn(PANEL, "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <p className={TECH_LABEL}>{label}</p>
        <span className={cn("h-2 w-2 rounded-full", tone === "warning" ? "bg-[var(--warn)]" : "bg-primary")} />
      </div>
      <p className="mt-3 text-[30px] font-semibold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function TenantUsageRow({ company }: { company: CompanyStats }) {
  return (
    <div className="rounded-[6px] border border-border bg-background px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-foreground">{company.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {fmtBytes(company.storage.usedBytes)} / {fmtBytes(company.storage.quotaBytes)}
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{company.storage.pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full", company.storage.pct >= 90 ? "bg-destructive" : company.storage.pct >= 70 ? "bg-[var(--warn)]" : "bg-primary")}
          style={{ width: `${company.storage.pct}%` }}
        />
      </div>
    </div>
  );
}

function DistributionRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-medium text-foreground">{label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="self-center font-mono text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] border border-border bg-background px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[18px] font-semibold leading-none tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function StatCard({ value, label, color = "default" }: { value: number; label: string; color?: "default" | "amber" | "green" | "blue" | "purple" }) {
  const colorMap = {
    default: "text-foreground",
    amber:   "text-amber-600 dark:text-amber-400",
    green:   "text-emerald-600 dark:text-emerald-400",
    blue:    "text-blue-600 dark:text-blue-400",
    purple:  "text-purple-600 dark:text-purple-400",
  };
  return (
    <div className={cn(PANEL, "p-4")}>
      <p className={cn("text-3xl font-semibold leading-none tabular-nums", colorMap[color])}>{value}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-[6px] bg-background px-3 py-2">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
      </div>
      <span className="mt-1 block font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className={TECH_LABEL}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={FIELD_CLASS}
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
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{inv.email}</p>
          <p className="text-xs text-muted-foreground truncate">
            {inv.company_name}{inv.notes ? ` · ${inv.notes}` : ""}
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <span className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${INVITE_STATUS_STYLES[inv.status] ?? ""}`}>
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
              className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
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
              className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
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
          className="flex w-full items-center gap-1.5 rounded-[6px] border border-amber-300/30 bg-amber-50/50 px-2 py-1 text-left transition-colors hover:bg-amber-100/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 sm:ml-12 sm:w-[calc(100%-3rem)]"
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
