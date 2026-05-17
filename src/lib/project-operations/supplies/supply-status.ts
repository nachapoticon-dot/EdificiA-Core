import type { ProjectSupplyItemStatus } from "@/types";

export function computeSupplyStatus(input: {
  required: number | null | undefined;
  ordered: number | null | undefined;
  received: number | null | undefined;
}): ProjectSupplyItemStatus {
  const required = input.required ?? null;
  const ordered = input.ordered ?? null;
  const received = input.received ?? null;
  if (required != null && received != null && received >= required) return "received";
  if (required != null && received != null && received > 0 && received < required) return "partial";
  if (ordered != null && ordered > 0) return "ordered";
  if (required != null && required > 0) return "planned";
  return "planned";
}
