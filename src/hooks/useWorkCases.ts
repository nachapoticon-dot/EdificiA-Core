"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  workCaseDetailResponseSchema,
  workCasesResponseSchema,
  type WorkCaseDetailResponse,
  type WorkCaseEntryResponse,
  type WorkCaseVerdict,
} from "@/lib/validators/api-responses";

export type WorkCaseEntry = WorkCaseEntryResponse;
export type WorkCaseDetail = WorkCaseDetailResponse;

export function useWorkCases(projectId?: string | null) {
  return useQuery<WorkCaseEntry[]>({
    queryKey: ["work-cases", projectId ?? "all"],
    enabled: projectId !== undefined,
    staleTime: 60_000,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return [];
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const res = await fetch(`/api/work-cases${query}`, { headers });
      if (!res.ok) return [];
      const parsed = workCasesResponseSchema.safeParse(await res.json());
      if (!parsed.success) return [];
      return parsed.data.workCases;
    },
  });
}

export function useWorkCaseDetails(workCaseId?: string | null) {
  return useQuery<WorkCaseDetail | null>({
    queryKey: ["work-case-detail", workCaseId ?? "none"],
    enabled: !!workCaseId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!workCaseId) return null;
      const headers = await getAuthHeaders();
      if (!headers.Authorization) return null;
      const res = await fetch(`/api/work-cases/${workCaseId}`, { headers });
      if (!res.ok) return null;
      const parsed = workCaseDetailResponseSchema.safeParse(await res.json());
      if (!parsed.success) return null;
      return parsed.data;
    },
  });
}

export interface UpdateWorkCaseInput {
  status: WorkCaseEntry["status"];
  summary?: string | null;
  verdict?: WorkCaseVerdict | null;
}

export async function updateWorkCaseStatus(
  workCaseId: string,
  input: UpdateWorkCaseInput | WorkCaseEntry["status"],
): Promise<WorkCaseDetail | null> {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) return null;
  const body: Record<string, unknown> =
    typeof input === "string"
      ? { status: input }
      : {
          status: input.status,
          ...(input.summary !== undefined ? { summary: input.summary } : {}),
          ...(input.verdict !== undefined ? { verdict: input.verdict } : {}),
        };
  const res = await fetch(`/api/work-cases/${workCaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const parsed = workCaseDetailResponseSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}
