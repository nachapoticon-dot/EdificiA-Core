"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useOrgs } from "@/hooks/useOrgs";
import { cn } from "@/lib/utils";

const ACTIVE_ORG_KEY = "edificia:active_org_id";

export function OrgSwitcher() {
  const { data: orgs = [] } = useOrgs();
  const [open, setOpen] = useState(false);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ORG_KEY) : null
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Only render for users in 2+ organizations
  if (orgs.length < 2) return null;

  const activeOrg = orgs.find((o) => o.orgId === activeOrgId) ?? orgs[0];

  function handleSelect(orgId: string) {
    if (orgId === activeOrg?.orgId) {
      setOpen(false);
      return;
    }
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    window.location.reload();
  }

  return (
    <div ref={ref} className="relative px-2 py-1.5 border-b">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
      >
        <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">{activeOrg?.orgName ?? "—"}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-md border bg-card shadow-lg">
          {orgs.map((org) => {
            const isActive = org.orgId === activeOrg?.orgId;
            return (
              <button
                key={org.orgId}
                onClick={() => handleSelect(org.orgId)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted",
                  isActive && "text-primary",
                )}
              >
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  {isActive && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate text-left font-medium">{org.orgName}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {org.role}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
