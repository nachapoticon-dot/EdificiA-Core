"use client";

import { useCallback, useState } from "react";
import { Copy, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  apiErrorResponseSchema,
  superAdminCompaniesResponseSchema,
  superAdminFounderResponseSchema,
  superAdminFoundersResponseSchema,
  superAdminMemberInviteResponseSchema,
  type SuperAdminCompanyStats,
  type SuperAdminFounderInvitation,
} from "@/lib/validators/api-responses";

type Tab = "founders" | "companies";
type Role = "admin" | "engineer" | "viewer";

const INVITE_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", accepted: "Aceptada", revoked: "Revocada" };
const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trial: "Prueba",
  suspended: "Suspendida",
  cancelled: "Cancelada",
};

const FIELD = "w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50";
const BUTTON = "inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-medium transition-opacity disabled:opacity-50";
const PANEL = "rounded-[8px] border border-border bg-card";

function formatBytes(b: number): string {
  if (b < 1_048_576) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const parsed = apiErrorResponseSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data.error : fallback;
}

/**
 * Panel global, protegido con SUPER_ADMIN_KEY: alta de empresas mediante
 * invitaciones de fundador y gestión de las organizaciones existentes.
 */
export default function SuperAdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("founders");
  const [invitations, setInvitations] = useState<SuperAdminFounderInvitation[]>([]);
  const [companies, setCompanies] = useState<SuperAdminCompanyStats[]>([]);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` }),
    [key],
  );

  const loadInvitations = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/founders", { headers: headers() });
    const parsed = res.ok ? superAdminFoundersResponseSchema.safeParse(await res.json()) : null;
    setLoading(false);
    if (!parsed?.success) {
      setAuthError(true);
      return;
    }
    setInvitations(parsed.data.invitations);
    setAuthed(true);
  }, [headers]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/super-admin/companies", { headers: headers() });
    const parsed = res.ok ? superAdminCompaniesResponseSchema.safeParse(await res.json()) : null;
    if (parsed?.success) setCompanies(parsed.data.companies);
    setLoading(false);
  }, [headers]);

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "companies" && companies.length === 0) void loadCompanies();
  }

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <form
          onSubmit={(e) => { e.preventDefault(); setAuthError(false); void loadInvitations(); }}
          className={cn(PANEL, "w-full max-w-sm space-y-4 p-6")}
        >
          <div>
            <h1 className="text-[18px] font-semibold">Super admin</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Ingresá la clave configurada en SUPER_ADMIN_KEY.</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setAuthError(false); }}
            className={FIELD}
            autoFocus
          />
          {authError && <p className="text-[12px] text-destructive">Clave incorrecta.</p>}
          <button type="submit" disabled={loading || !key} className={cn(BUTTON, "w-full bg-primary text-primary-foreground")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ingresar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-background px-5 py-8">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-[22px] font-semibold">Super admin</h1>
        <button
          onClick={() => void (tab === "founders" ? loadInvitations() : loadCompanies())}
          disabled={loading}
          title="Actualizar"
          className={cn(BUTTON, "border border-border")}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </header>

      <nav className="flex gap-1 rounded-[8px] border border-border bg-card p-1">
        {(["founders", "companies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={cn(
              "flex-1 rounded-[6px] px-3 py-2 text-[12px] font-semibold",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "founders" ? "Invitaciones de fundador" : "Empresas"}
          </button>
        ))}
      </nav>

      {tab === "founders" ? (
        <FoundersTab invitations={invitations} setInvitations={setInvitations} headers={headers} />
      ) : (
        <CompaniesTab companies={companies} setCompanies={setCompanies} headers={headers} loading={loading} />
      )}
    </main>
  );
}

interface FoundersTabProps {
  invitations: SuperAdminFounderInvitation[];
  setInvitations: React.Dispatch<React.SetStateAction<SuperAdminFounderInvitation[]>>;
  headers: () => Record<string, string>;
}

function FoundersTab({ invitations, setInvitations, headers }: FoundersTabProps) {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    const res = await fetch("/api/super-admin/founders", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email: email.trim(), company_name: companyName.trim(), notes: notes.trim() || undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(await readError(res, "No se pudo crear la invitación."));
      return;
    }
    const parsed = superAdminFounderResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      setError("Respuesta inválida del servidor.");
      return;
    }
    setInvitations((prev) => [parsed.data.invitation, ...prev]);
    setEmail("");
    setCompanyName("");
    setNotes("");
  }

  async function revoke(id: string) {
    setBusy(id);
    await fetch(`/api/super-admin/founders?id=${id}`, { method: "DELETE", headers: headers() });
    setInvitations((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: "revoked" } : inv)));
    setBusy(null);
  }

  async function reactivate(id: string) {
    setBusy(id);
    const res = await fetch("/api/super-admin/founders", { method: "PATCH", headers: headers(), body: JSON.stringify({ id }) });
    const parsed = res.ok ? superAdminFounderResponseSchema.safeParse(await res.json()) : null;
    if (parsed?.success) setInvitations((prev) => prev.map((inv) => (inv.id === id ? parsed.data.invitation : inv)));
    setBusy(null);
  }

  function copyRegisterLink(inv: SuperAdminFounderInvitation) {
    const url = `${window.location.origin}/register?email=${encodeURIComponent(inv.email)}&token=${inv.invite_token ?? ""}`;
    void navigator.clipboard.writeText(url);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className={cn(PANEL, "grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]")}>
        <input required type="email" placeholder="Email del fundador" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} />
        <input required placeholder="Nombre de la empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={FIELD} />
        <input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
        <button type="submit" disabled={busy === "create"} className={cn(BUTTON, "bg-primary text-primary-foreground")}>
          {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invitar"}
        </button>
        {error && <p className="text-[12px] text-destructive sm:col-span-4">{error}</p>}
      </form>

      <section className={cn(PANEL, "divide-y divide-border")}>
        {invitations.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Sin invitaciones.</p>}
        {invitations.map((inv) => (
          <div key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{inv.email}</p>
              <p className="truncate text-[12px] text-muted-foreground">
                {inv.company_name}{inv.notes ? ` · ${inv.notes}` : ""} · vence {new Date(inv.expires_at).toLocaleDateString("es-AR")}
              </p>
            </div>
            <span className="rounded-[6px] bg-accent px-2 py-0.5 text-[11px]">{INVITE_STATUS_LABELS[inv.status] ?? inv.status}</span>
            {inv.status === "pending" && inv.invite_token && (
              <button onClick={() => copyRegisterLink(inv)} title="Copiar link de registro" className={cn(BUTTON, "border border-border px-2")}>
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {inv.status === "pending" ? (
              <button onClick={() => void revoke(inv.id)} disabled={busy === inv.id} title="Revocar" className={cn(BUTTON, "border border-border px-2")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => void reactivate(inv.id)} disabled={busy === inv.id} title="Reactivar" className={cn(BUTTON, "border border-border px-2")}>
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

interface CompaniesTabProps {
  companies: SuperAdminCompanyStats[];
  setCompanies: React.Dispatch<React.SetStateAction<SuperAdminCompanyStats[]>>;
  headers: () => Record<string, string>;
  loading: boolean;
}

function CompaniesTab({ companies, setCompanies, headers, loading }: CompaniesTabProps) {
  const [invitingFor, setInvitingFor] = useState<string | null>(null);

  async function patch(id: string, change: { disabled?: boolean; subscriptionStatus?: string }) {
    await fetch("/api/super-admin/companies", { method: "PATCH", headers: headers(), body: JSON.stringify({ id, ...change }) });
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...change } : c)));
  }

  if (loading && companies.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Cargando…</p>;
  }

  return (
    <section className={cn(PANEL, "divide-y divide-border")}>
      {companies.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Sin empresas.</p>}
      {companies.map((c) => (
        <div key={c.id} className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-medium", c.disabled && "text-muted-foreground line-through")}>{c.name}</p>
              <p className="text-[12px] text-muted-foreground">
                {c.members} miembros · {c.projects} obras · {formatBytes(c.storage.usedBytes)} de {formatBytes(c.storage.quotaBytes)}
              </p>
            </div>
            <select
              value={c.subscriptionStatus}
              onChange={(e) => void patch(c.id, { subscriptionStatus: e.target.value })}
              className={cn(FIELD, "w-auto py-1.5")}
            >
              {Object.entries(SUB_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button onClick={() => void patch(c.id, { disabled: !c.disabled })} className={cn(BUTTON, "border border-border")}>
              {c.disabled ? "Habilitar" : "Deshabilitar"}
            </button>
            <button onClick={() => setInvitingFor(invitingFor === c.id ? null : c.id)} className={cn(BUTTON, "border border-border")}>
              Invitar miembro
            </button>
          </div>
          {invitingFor === c.id && <InviteMemberForm orgId={c.id} headers={headers} />}
        </div>
      ))}
    </section>
  );
}

function InviteMemberForm({ orgId, headers }: { orgId: string; headers: () => Record<string, string> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/super-admin/members", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ orgId, email: email.trim(), role }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(await readError(res, "No se pudo enviar la invitación."));
      return;
    }
    const parsed = superAdminMemberInviteResponseSchema.safeParse(await res.json());
    setMessage(parsed.success ? `Invitación enviada a ${email.trim()}.` : "Respuesta inválida del servidor.");
    if (parsed.success) setEmail("");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(FIELD, "max-w-xs")} />
      <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cn(FIELD, "w-auto")}>
        <option value="admin">Admin</option>
        <option value="engineer">Ingeniero</option>
        <option value="viewer">Lectura</option>
      </select>
      <button type="submit" disabled={busy} className={cn(BUTTON, "bg-primary text-primary-foreground")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
      </button>
      {message && <p className="w-full text-[12px] text-muted-foreground">{message}</p>}
    </form>
  );
}
