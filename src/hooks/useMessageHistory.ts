import type { UIMessage } from "ai";
import { getAuthToken } from "@/lib/insforge/client";

const PREFIX   = "edificia_msgs_";
const MAX_MSGS = 100;

// ── localStorage helpers ─────────────────────────────────────────────────────��

export function saveMessages(sessionId: string, messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  const trimmed = messages.slice(-MAX_MSGS);
  localStorage.setItem(PREFIX + sessionId, JSON.stringify(trimmed));
  void syncMessagesToDb(sessionId, trimmed);
}

export function loadMessages(sessionId: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export function deleteMessages(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + sessionId);
}

// ── Remote helpers ────────────────────────────────────────────────────────────

async function getApiHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function syncMessagesToDb(sessionId: string, messages: UIMessage[]): Promise<void> {
  try {
    await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await getApiHeaders()) },
      body: JSON.stringify({ messages }),
    });
  } catch { /* non-blocking */ }
}

/** Fetches messages from DB when localStorage has none (cross-device access). */
export async function fetchRemoteMessages(sessionId: string): Promise<UIMessage[]> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, {
      headers: await getApiHeaders(),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { messages: UIMessage[] };
    return json.messages ?? [];
  } catch {
    return [];
  }
}
