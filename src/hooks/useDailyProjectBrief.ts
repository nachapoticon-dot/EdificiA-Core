"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import {
  dailyBriefResponseSchema,
  type DailyBriefResponse,
} from "@/lib/validators/api-responses";

interface UseDailyProjectBriefOptions {
  enabled?: boolean;
  includeWeather?: boolean;
  location?: string | null;
}

export function useDailyProjectBrief(projectId: string | null, options: UseDailyProjectBriefOptions = {}) {
  const includeWeather = options.includeWeather ?? false;
  const location = options.location?.trim() || null;

  return useQuery<DailyBriefResponse>({
    queryKey: ["daily-project-brief", projectId, includeWeather, location],
    enabled: !!projectId && (options.enabled ?? true),
    staleTime: 60_000,
    queryFn: async () => {
      if (!projectId) throw new Error("projectId requerido");
      const params = new URLSearchParams();
      if (includeWeather) params.set("weather", "1");
      if (location) params.set("location", location);

      const query = params.toString();
      const res = await fetch(`/api/projects/${projectId}/daily-brief${query ? `?${query}` : ""}`, {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("daily brief fetch failed");

      const parsed = dailyBriefResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid daily brief response");
      return parsed.data;
    },
  });
}
