import type { UIMessage } from "ai";
import { safeValidateUIMessages } from "ai";
import { z } from "zod";
import { getAuthToken } from "@/lib/insforge/client";

const PREFIX   = "edificia_msgs_";
const MAX_MSGS = 100;

const remoteMessagesWrapperSchema = z.object({
  messages: z.array(z.unknown()),
});

// ── localStorage helpers ──────────────────────────────────────────────────────

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
    const res = await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await getApiHeaders()) },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) {
      console.warn("[chat] syncMessagesToDb non-ok", { sessionId, status: res.status });
    }
  } catch (err) {
    console.warn("[chat] syncMessagesToDb failed", { sessionId, err });
  }
}

/** Fetches messages from DB when localStorage has none (cross-device access). */
export async function fetchRemoteMessages(sessionId: string): Promise<UIMessage[]> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, {
      headers: await getApiHeaders(),
    });
    if (!res.ok) {
      console.warn("[chat] fetchRemoteMessages non-ok", { sessionId, status: res.status });
      return [];
    }

    // Validar el wrapper antes de tocar el contenido — defiende contra cambios
    // del endpoint que rompen el shape sin que TS se entere.
    const wrapper = remoteMessagesWrapperSchema.safeParse(await res.json());
    if (!wrapper.success) {
      console.warn("[chat] fetchRemoteMessages: invalid wrapper", {
        sessionId,
        issues: wrapper.error.flatten(),
      });
      return [];
    }

    // Validar el array de UIMessage usando el helper oficial del AI SDK.
    // Si llegan parts desconocidas (p. ej. reasoning de un modelo nuevo),
    // safeValidateUIMessages las acepta como parts genéricas.
    const validated = await safeValidateUIMessages({ messages: wrapper.data.messages });
    if (!validated.success) {
      console.warn("[chat] fetchRemoteMessages: invalid UI messages", {
        sessionId,
        error: validated.error?.message,
      });
      return [];
    }
    return validated.data as UIMessage[];
  } catch (err) {
    console.warn("[chat] fetchRemoteMessages threw", { sessionId, err });
    return [];
  }
}
