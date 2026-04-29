"use client";

import { SessionSidebar } from "./SessionSidebar";
import { useSessionContext } from "@/contexts/SessionContext";

export function DashboardSidebar() {
  const { sessionId, resetSession } = useSessionContext();
  return <SessionSidebar currentSessionId={sessionId} onNewSession={resetSession} />;
}
