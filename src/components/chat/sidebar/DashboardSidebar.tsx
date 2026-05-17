"use client";

import { SessionSidebar } from "./SessionSidebar";
import { useSessionContext } from "@/contexts/SessionContext";

export function DashboardSidebar() {
  const { sessionId, resetSession, switchSession } = useSessionContext();
  return (
    <SessionSidebar
      currentSessionId={sessionId}
      onNewSession={resetSession}
      onSessionSelect={switchSession}
    />
  );
}
