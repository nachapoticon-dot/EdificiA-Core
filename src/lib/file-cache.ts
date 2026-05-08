import { randomUUID } from "crypto";
import type { BudgetItem } from "@/lib/math-engine/validators";

interface CacheEntry {
  items: BudgetItem[];
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

/** Store budget items and return a short-lived cache ID (2h TTL). */
export function cacheItems(items: BudgetItem[]): string {
  const id = randomUUID();
  const now = Date.now();
  _cache.set(id, { items, expiresAt: now + 7_200_000 });
  // Prune expired entries on every write
  for (const [k, v] of _cache) {
    if (now > v.expiresAt) _cache.delete(k);
  }
  return id;
}

/** Retrieve cached items by ID, or null if expired/not found. */
export function getItems(cacheId: string): BudgetItem[] | null {
  const entry = _cache.get(cacheId);
  if (!entry || Date.now() > entry.expiresAt) {
    _cache.delete(cacheId);
    return null;
  }
  return entry.items;
}
