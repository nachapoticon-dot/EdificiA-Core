"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getInsForgeClient, clearPersistedToken } from "@/lib/insforge/client";
import { useOrgMember } from "@/hooks/useOrgMember";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  engineer: "Ingeniero",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "text-primary bg-primary/10",
  engineer: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  viewer: "text-muted-foreground bg-muted",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const router = useRouter();
  const state = useOrgMember();

  async function handleLogout() {
    try {
      await getInsForgeClient().auth.signOut();
    } catch {
      // ignore — we always clear local state regardless
    }
    await fetch("/api/auth/logout", { method: "POST" });
    clearPersistedToken();
    router.push("/login");
    router.refresh();
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (state.status === "error") return null;

  const { member } = state;
  const displayName = member.email ?? member.userId.slice(0, 8);
  const avatar = initials(displayName);
  const roleLabel = ROLE_LABELS[member.role] ?? member.role;
  const roleColor = ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer;

  return (
    <div className="flex items-center gap-2 px-1">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
        {avatar}
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight">{displayName}</p>
        <span className={`inline-block rounded-full px-1.5 py-px text-[9px] font-semibold leading-none ${roleColor}`}>
          {roleLabel}
        </span>
      </div>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => { void handleLogout(); }}
        title="Cerrar sesión"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
