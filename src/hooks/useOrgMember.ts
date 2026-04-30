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

export function useOrgMember(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const headers = getInsForgeClient().getHttpClient().getHeaders();
    if (!headers.Authorization) {
      setState({ status: "error" });
      return;
    }

    fetch("/api/auth/me", { headers: { Authorization: headers.Authorization } })
      .then((r) => {
        if (!r.ok) throw new Error("not ok");
        return r.json() as Promise<OrgMember>;
      })
      .then((data) => setState({ status: "ok", member: data }))
      .catch(() => setState({ status: "error" }));
  }, []);

  return state;
}
