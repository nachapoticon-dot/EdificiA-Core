"use client";

import { useQuery } from "@tanstack/react-query";
import { getInsForgeClient } from "@/lib/insforge/client";
import type { OrgOption } from "@/app/api/auth/orgs/route";

export type { OrgOption };

export function useOrgs() {
  return useQuery<OrgOption[]>({
    queryKey: ["orgs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const h = getInsForgeClient().getHttpClient().getHeaders();
      if (!h.Authorization) return [];
      const res = await fetch("/api/auth/orgs", {
        headers: { Authorization: h.Authorization as string },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { orgs: OrgOption[] };
      return json.orgs ?? [];
    },
  });
}
