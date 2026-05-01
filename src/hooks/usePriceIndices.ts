"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInsForgeClient } from "@/lib/insforge/client";
import type { PriceIndexRow } from "@/lib/indices/query";
import type { ParsedPriceRow } from "@/lib/indices/upload-parser";

function getAuthHeaders(): Record<string, string> {
  const h = getInsForgeClient().getHttpClient().getHeaders() as Record<string, string>;
  return h["Authorization"] ? { Authorization: h["Authorization"] } : {};
}

export { type PriceIndexRow };

export function usePriceIndices() {
  return useQuery<PriceIndexRow[]>({
    queryKey: ["price-indices"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/indices", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("indices fetch failed");
      const json = (await res.json()) as { indices: PriceIndexRow[] };
      return json.indices ?? [];
    },
  });
}

export interface UploadPreview {
  preview:      ParsedPriceRow[];
  total:        number;
  warnings:     string[];
  period_year:  number;
  period_month: number;
}

export function useUploadPriceList() {
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: async (opts: { file: File; source: string; notes?: string }): Promise<UploadPreview> => {
      const fd = new FormData();
      fd.append("file",   opts.file);
      fd.append("source", opts.source);
      if (opts.notes) fd.append("notes", opts.notes);
      const res = await fetch("/api/indices/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error("preview failed");
      return res.json() as Promise<UploadPreview>;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (opts: { file: File; source: string; notes?: string }) => {
      const fd = new FormData();
      fd.append("file",    opts.file);
      fd.append("source",  opts.source);
      fd.append("confirm", "true");
      if (opts.notes) fd.append("notes", opts.notes);
      const res = await fetch("/api/indices/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      return res.json() as Promise<{ inserted: number; warnings: string[] }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-indices"] }),
  });

  return { previewMutation, confirmMutation };
}
