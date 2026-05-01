"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Mail, Shield, ChevronDown, Link2, Trash2, Loader2, Plus, CheckCircle2, Brain, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgMember } from "@/hooks/useOrgMember";
import { getInsForgeClient } from "@/lib/insforge/client";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Invitation {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  token: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  engineer: "Ingeniero",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  engineer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export default function AdminMembersPage() {
  const orgMember = useOrgMember();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("engineer");
  const [inviting, setInviting] = useState(false);
  const [lastInvited, setLastInvited] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (orgMember.status === "ok" && orgMember.member.role !== "admin") {
      router.replace("/dashboard/chat");
    }
  }, [orgMember, router]);

  const fetchMembers = useCallback(async () => {
    const headers = getInsForgeClient().getHttpClient().getHeaders();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/members", { headers: { Authorization: headers.Authorization } });
    if (!res.ok) return;
    const data = (await res.json()) as { members: Member[]; invitations: Invitation[] };
    setMembers(data.members);
    setInvitations(data.invitations);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (orgMember.status === "ok" && orgMember.member.role === "admin") {
      void fetchMembers();
    }
  }, [orgMember, fetchMembers]);

  const getAuthHeader = (): Record<string, string> => {
    const h = getInsForgeClient().getHttpClient().getHeaders();
    return h.Authorization ? { Authorization: h.Authorization as string } : {};
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToInvite = inviteEmail.trim();
    if (!emailToInvite) return;
    setInviting(true);
    try {
      await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ email: emailToInvite, role: inviteRole }),
      });
      setInviteEmail("");
      setLastInvited(emailToInvite);
      setTimeout(() => setLastInvited(null), 5000);
      await fetchMembers();
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ memberId, newRole }),
    });
    await fetchMembers();
  };

  const handleRevokeMember = async (memberId: string) => {
    await fetch(`/api/admin/members?memberId=${memberId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    await fetchMembers();
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    await fetch(`/api/admin/members?invitationId=${invitationId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    await fetchMembers();
  };

  const handleCopyLink = (email: string) => {
    const url = `${window.location.origin}/register?email=${encodeURIComponent(email)}`;
    void navigator.clipboard.writeText(url);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  if (orgMember.status === "loading" || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orgMember.status !== "ok") return null;

  const currentUserId = orgMember.member.userId;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-primary" />
          Panel de administración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná los miembros de <strong>{orgMember.member.orgName}</strong>
        </p>
      </div>

      {/* Invite form */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          Invitar nuevo miembro
        </h2>
        <form onSubmit={(e) => { void handleInvite(e); }} className="flex flex-wrap gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@empresa.com"
            required
            className="flex-1 min-w-48 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="engineer">Ingeniero</option>
            <option value="viewer">Visualizador</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" size="sm" disabled={inviting}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invitar"}
          </Button>
        </form>
        {lastInvited && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Email de invitación enviado a <strong>{lastInvited}</strong>
          </p>
        )}
      </section>

      {/* Members list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Miembros activos ({members.length})
        </h2>
        <div className="divide-y rounded-xl border bg-card overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                {m.user_id.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate font-mono">{m.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role] ?? ""}`}>
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
              {m.user_id !== currentUserId && (
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <select
                      value={m.role}
                      onChange={(e) => { void handleChangeRole(m.id, e.target.value); }}
                      className="appearance-none rounded border bg-background px-2 py-1 pr-6 text-xs focus:outline-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="engineer">Ingeniero</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 h-3 w-3 text-muted-foreground" />
                  </div>
                  <button
                    onClick={() => { void handleRevokeMember(m.id); }}
                    className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Revocar acceso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {m.user_id === currentUserId && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Vos</span>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin miembros</p>
          )}
        </div>
      </section>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Invitaciones pendientes ({invitations.length})
          </h2>
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.invited_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira {new Date(inv.expires_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[inv.role] ?? ""}`}>
                  {ROLE_LABELS[inv.role] ?? inv.role}
                </span>
                <button
                  onClick={() => handleCopyLink(inv.invited_email)}
                  className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Copiar link de registro"
                >
                  <Link2 className="h-3 w-3" />
                  {copied === inv.invited_email ? "¡Copiado!" : "Copiar link"}
                </button>
                <button
                  onClick={() => { void handleRevokeInvitation(inv.id); }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => router.push("/dashboard/admin/indices" as never)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          Índices de precio
        </button>
        <button
          onClick={() => router.push("/dashboard/admin/patterns" as never)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Brain className="h-4 w-4" />
          Lo que EdificIA aprendió
        </button>
        <button
          onClick={() => router.push("/dashboard/admin/settings")}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Shield className="h-4 w-4" />
          Configuración de la empresa
        </button>
      </div>
    </div>
  );
}
