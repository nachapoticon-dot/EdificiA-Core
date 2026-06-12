"use client";

import { Shield } from "lucide-react";
import { useOrgMember } from "@/hooks/useOrgMember";
import { NavLink } from "./NavLink";

/** Renders the Admin nav link only when the current user has the 'admin' role. */
export function AdminNavLink() {
  const state = useOrgMember();
  if (state.status !== "ok" || state.member.role !== "admin") return null;

  return (
    <NavLink
      href="/dashboard/admin"
      icon={<Shield className="h-3.5 w-3.5" />}
      label="Administración"
    />
  );
}
