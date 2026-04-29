"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { saveSession } from "@/hooks/useSessionHistory";
import type { SessionEntry } from "@/hooks/useSessionHistory";

interface SessionContextValue {
  sessionId: string;
  recordSession: (title: string, fileType?: SessionEntry["fileType"]) => void;
  resetSession: () => void;
  switchSession: (entry: SessionEntry) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function newId(): string {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(newId);
  const savedRef = useRef(false);

  const recordSession = useCallback(
    (title: string, fileType?: SessionEntry["fileType"]) => {
      if (savedRef.current) return;
      savedRef.current = true;
      saveSession({ id: sessionId, title, fileType, startedAt: Date.now() });
    },
    [sessionId],
  );

  const resetSession = useCallback(() => {
    savedRef.current = false;
    setSessionId(newId());
    // Chat page's useEffect watches sessionId and calls setMessages([])
  }, []);

  const switchSession = useCallback((entry: SessionEntry) => {
    savedRef.current = true; // already recorded — don't duplicate
    setSessionId(entry.id);
    // Chat page's useEffect watches sessionId and calls setMessages(loadMessages(id))
  }, []);

  return (
    <SessionContext value={{ sessionId, recordSession, resetSession, switchSession }}>
      {children}
    </SessionContext>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used inside SessionProvider");
  return ctx;
}
