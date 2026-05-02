"use client";

import { useEffect, useState } from "react";
import { getInsForgeClient } from "@/lib/insforge/client";

export interface OrgMember {
  userId: string;
  orgId: string;
  role: string;
  orgName: string;
  branding: {
    primaryColor: string;
    logoUrl: string | null;
    agentName: string;
  };
}

type State =
  | { status: "loading" }
  | { status: "ok"; member: OrgMember }
  | { status: "error" };

const ACTIVE_ORG_KEY = "edificia:active_org_id";

export function useOrgMember(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const headers = getInsForgeClient().getHttpClient().getHeaders();
    if (!headers.Authorization) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "error" });
      return;
    }

    const reqHeaders: Record<string, string> = {
      Authorization: headers.Authorization as string,
    };

    // Pass the active org selection so /api/auth/me returns the right org
    const activeOrgId = localStorage.getItem(ACTIVE_ORG_KEY);
    if (activeOrgId) reqHeaders["x-org-id"] = activeOrgId;

    fetch("/api/auth/me", { headers: reqHeaders })
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<OrgMember>;
      })
      .then((data) => setState({ status: "ok", member: data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  return state;
}
