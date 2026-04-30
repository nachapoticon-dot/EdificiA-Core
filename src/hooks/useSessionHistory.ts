"use client";

import { useState, useEffect, useCallback } from "react";

export interface SessionEntry {
  id: string;
  title: string;
  fileType?: "excel" | "pdf" | "dxf" | "docx" | "image";
  startedAt: number;
}

const STORAGE_KEY = "edificia_sessions";
const MAX_SESSIONS = 30;
const UPDATE_EVENT = "edificia-session-updated";

function loadSessions(): SessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SessionEntry[];
  } catch {
    return [];
  }
}

export function saveSession(entry: SessionEntry): void {
  const current = loadSessions();
  const updated = [entry, ...current.filter((s) => s.id !== entry.id)].slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);

  useEffect(() => {
    setSessions(loadSessions());
    const handler = () => setSessions(loadSessions());
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }, []);

  const deleteSession = useCallback((id: string) => {
    const updated = loadSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Also remove the messages for that session
    localStorage.removeItem(`edificia_messages_${id}`);
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }, []);

  return { sessions, clearAll, deleteSession };
}
