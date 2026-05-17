"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/insforge/client";
import type { PriceIndexRow } from "@/lib/indices/query";
import type { ParsedPriceRow } from "@/lib/indices/upload-parser";
import {
  priceIndexUploadConfirmResponseSchema,
  priceIndexUploadPreviewResponseSchema,
  priceIndicesResponseSchema,
} from "@/lib/validators/api-responses";

export { type PriceIndexRow };

export function usePriceIndices() {
  return useQuery<PriceIndexRow[]>({
    queryKey: ["price-indices"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/indices", { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error("indices fetch failed");
      const parsed = priceIndicesResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid indices response");
      return parsed.data.indices;
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
        headers: await getAuthHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error("preview failed");
      const parsed = priceIndexUploadPreviewResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid upload preview response");
      return parsed.data;
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
        headers: await getAuthHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error("upload failed");
      const parsed = priceIndexUploadConfirmResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("invalid upload confirm response");
      return parsed.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["price-indices"] }),
  });

  return { previewMutation, confirmMutation };
}
