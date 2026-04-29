import type { UIMessage } from "ai";

const PREFIX = "edificia_msgs_";
const MAX_MSGS = 100;

export function saveMessages(sessionId: string, messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + sessionId, JSON.stringify(messages.slice(-MAX_MSGS)));
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
