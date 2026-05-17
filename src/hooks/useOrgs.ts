"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import { orgsResponseSchema, type OrgOptionResponse } from "@/lib/validators/api-responses";

export type OrgOption = OrgOptionResponse;

export function useOrgs() {
  return useQuery<OrgOption[]>({
    queryKey: ["orgs"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return [];
      const res = await fetch("/api/auth/orgs", { headers });
      if (!res.ok) return [];
      const parsed = orgsResponseSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return parsed.data.orgs;
    },
  });
}
