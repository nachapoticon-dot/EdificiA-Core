"use client";

import { Building2, Users, FolderOpen, ChevronDown, Check } from "lucide-react";
import { useOrgMember } from "@/hooks/useOrgMember";
import { useOrgs } from "@/hooks/useOrgs";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const ACTIVE_ORG_KEY = "edificia:active_org_id";

const ROLE_LABELS: Record<string, string> = {
  founder: "FOUNDER",
  admin:   "ADMIN",
  editor:  "EDITOR",
  viewer:  "VIEWER",
};

const ROLE_COLORS: Record<string, string> = {
  founder: "text-[oklch(0.62_0.18_310)] bg-[oklch(0.97_0.04_310)] border-[oklch(0.88_0.08_310)]",
  admin:   "text-primary bg-primary/5 border-primary/20",
  editor:  "text-[oklch(0.58_0.15_240)] bg-[oklch(0.97_0.03_240)] border-[oklch(0.88_0.06_240)]",
  viewer:  "text-muted-foreground bg-muted/50 border-border",
};

export function OrganizationCard() {
  const orgMember = useOrgMember();
  const { data: orgs = [] } = useOrgs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (orgMember.status === "loading") {
    return (
      <div className="mx-2 mb-2 animate-pulse rounded-xl border border-border bg-card p-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-2 h-2 w-16 rounded bg-muted/60" />
      </div>
    );
  }

  if (orgMember.status === "error") return null;

  const { member } = orgMember;
  const roleKey = member.role.toLowerCase();
  const roleLabel = ROLE_LABELS[roleKey] ?? member.role.toUpperCase();
  const roleColor = ROLE_COLORS[roleKey] ?? ROLE_COLORS.viewer;
  const isMultiOrg = orgs.length > 1;

  function handleSwitchOrg(orgId: string) {
    if (orgId === member.orgId) { setOpen(false); return; }
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    window.location.reload();
  }

  return (
    <div ref={ref} className="relative mx-2 mb-2">
      {/* Card */}
      <div
        className={cn(
          "group rounded-xl border border-border bg-card p-3 transition-colors",
          isMultiOrg && "cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02]",
        )}
        onClick={() => isMultiOrg && setOpen((v) => !v)}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <p className="truncate text-[12px] font-semibold text-foreground">{member.orgName}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn("rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]", roleColor)}>
              {roleLabel}
            </span>
            {isMultiOrg && (
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-2 flex items-center gap-3">
          <Stat icon={FolderOpen} label={`${member.stats.activeProjects} obra${member.stats.activeProjects !== 1 ? "s" : ""}`} />
          <span className="h-3 w-px bg-border" />
          <Stat icon={Users} label={`${member.stats.memberCount} miembro${member.stats.memberCount !== 1 ? "s" : ""}`} />
        </div>
      </div>

      {/* Multi-org dropdown */}
      {open && isMultiOrg && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {orgs.map((org) => {
            const isActive = org.orgId === member.orgId;
            return (
              <button
                key={org.orgId}
                onClick={() => handleSwitchOrg(org.orgId)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-accent",
                  isActive && "text-primary",
                )}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {isActive && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="flex-1 truncate text-left font-medium">{org.orgName}</span>
                <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">
                  {ROLE_LABELS[org.role?.toLowerCase() ?? ""] ?? org.role}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="h-2.5 w-2.5 text-muted-foreground/60" />
      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
