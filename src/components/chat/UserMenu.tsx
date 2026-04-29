"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getInsForgeClient } from "@/lib/insforge/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const router = useRouter();
  const state = useCurrentUser();

  async function handleLogout() {
    await getInsForgeClient().auth.signOut();
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

  const { user } = state;
  const displayName = user.profile?.name ?? user.email;
  const avatar = initials(displayName);

  return (
    <div className="flex items-center gap-2 px-1">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
        {avatar}
      </div>

      {/* Name / email */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight">{displayName}</p>
        {user.profile?.name && (
          <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
        )}
      </div>

      {/* Logout */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleLogout}
        title="Cerrar sesión"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
