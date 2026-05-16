"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthToken } from "@/lib/insforge/client";

export interface SessionEntry {
  id: string;
  title: string;
  fileType?: "excel" | "pdf" | "dxf" | "docx" | "image";
  startedAt: number;
  projectId?: string;
}

const STORAGE_KEY  = "edificia_sessions";
const MAX_SESSIONS = 30;
const UPDATE_EVENT = "edificia-session-updated";

// ── localStorage helpers ────────────────────────────────────────────���─────────

function loadSessions(): SessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SessionEntry[];
  } catch {
    return [];
  }
}

function persistLocally(sessions: SessionEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

// ── API helpers (fire-and-forget, never throw) ────────────────────────────────

async function getApiHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const activeOrgId = localStorage.getItem("edificia:active_org_id");
  if (activeOrgId) headers["x-org-id"] = activeOrgId;
  return headers;
}

async function syncSessionToDb(entry: SessionEntry): Promise<void> {
  try {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getApiHeaders()) },
      body: JSON.stringify(entry),
    });
  } catch { /* non-blocking */ }
}

async function deleteSessionFromDb(id: string): Promise<void> {
  try {
    await fetch(`/api/sessions?id=${id}`, {
      method: "DELETE",
      headers: await getApiHeaders(),
    });
  } catch { /* non-blocking */ }
}

async function clearAllSessionsFromDb(): Promise<void> {
  try {
    await fetch("/api/sessions?clearAll=true", {
      method: "DELETE",
      headers: await getApiHeaders(),
    });
  } catch { /* non-blocking */ }
}

async function fetchRemoteSessions(): Promise<SessionEntry[]> {
  try {
    const res = await fetch("/api/sessions", { headers: await getApiHeaders() });
    if (!res.ok) return [];
    const json = (await res.json()) as { sessions: SessionEntry[] };
    return json.sessions ?? [];
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function saveSession(entry: SessionEntry): void {
  const current = loadSessions();
  const updated = [entry, ...current.filter((s) => s.id !== entry.id)].slice(0, MAX_SESSIONS);
  persistLocally(updated);
  void syncSessionToDb(entry);
}

export function useSessionHistory() {
  // Start empty to match SSR, then hydrate from localStorage in useEffect
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  useEffect(() => {
    // Initial hydration from localStorage after mount
    setSessions(loadSessions());

    const handler = () => setSessions(loadSessions());
    window.addEventListener(UPDATE_EVENT, handler);

    // Merge remote sessions into localStorage (provides cross-device access)
    void fetchRemoteSessions().then((remote) => {
      if (remote.length === 0) return;
      const local = loadSessions();
      const localIds = new Set(local.map((s) => s.id));
      const newEntries = remote.filter((r) => !localIds.has(r.id));
      if (newEntries.length === 0) return;
      const merged = [...local, ...newEntries]
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_SESSIONS);
      persistLocally(merged);
    });

    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(UPDATE_EVENT));
    void clearAllSessionsFromDb();
  }, []);

  const deleteSession = useCallback((id: string) => {
    const updated = loadSessions().filter((s) => s.id !== id);
    persistLocally(updated);
    localStorage.removeItem(`edificia_msgs_${id}`);
    void deleteSessionFromDb(id);
  }, []);

  return { sessions, clearAll, deleteSession };
}
