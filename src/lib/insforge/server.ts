import { createClient } from "@insforge/sdk";

const BASE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL;
const SERVICE_ROLE_KEY = process.env.INSFORGE_SERVICE_ROLE_KEY;

/**
 * Creates an admin InsForge client for server-side operations.
 * Uses the service role key — bypasses RLS. Never expose to the browser.
 * Always create a new instance per request to avoid token bleed between users.
 */
export function getInsForgeAdminClient() {
  if (!BASE_URL) throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL — set it in .env.local");
  if (!SERVICE_ROLE_KEY) throw new Error("Missing INSFORGE_SERVICE_ROLE_KEY — set it in .env.local");

  return createClient({
    baseUrl: BASE_URL,
    anonKey: SERVICE_ROLE_KEY,
    isServerMode: true,
  });
}
