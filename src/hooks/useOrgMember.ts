"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/lib/insforge/client";

import type { OrgMember } from "@/types";
export type { OrgMember } from "@/types";

type State =
  | { status: "loading" }
  | { status: "ok"; member: OrgMember }
  | { status: "error" };

const ACTIVE_ORG_KEY = "edificia:active_org_id";

export function useOrgMember(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders.Authorization) {
        if (!cancelled) setState({ status: "error" });
        return;
      }
      const activeOrgId = localStorage.getItem(ACTIVE_ORG_KEY);
      const reqHeaders = { ...authHeaders, ...(activeOrgId ? { "x-org-id": activeOrgId } : {}) };
      try {
        const r = await fetch("/api/auth/me", { headers: reqHeaders });
        if (!r.ok) throw new Error("not ok");
        const data = await r.json() as OrgMember;
        if (!cancelled) setState({ status: "ok", member: data });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
