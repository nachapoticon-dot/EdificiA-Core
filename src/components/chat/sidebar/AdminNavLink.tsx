"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useOrgMember } from "@/hooks/useOrgMember";

/** Renders the Admin nav link only when the current user has the 'admin' role. */
export function AdminNavLink() {
  const state = useOrgMember();
  if (state.status !== "ok" || state.member.role !== "admin") return null;

  return (
    <Link
      href="/dashboard/admin"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Shield className="h-4 w-4" />
      Administración
    </Link>
  );
}
