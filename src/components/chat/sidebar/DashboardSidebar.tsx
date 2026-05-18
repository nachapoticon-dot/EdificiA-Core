"use client";

import { useRouter } from "next/navigation";
import { SessionSidebar } from "./SessionSidebar";
import { useSessionContext } from "@/contexts/SessionContext";
import type { SessionEntry } from "@/hooks/useSessionHistory";

export function DashboardSidebar() {
  const router = useRouter();
  const { sessionId, resetSession, switchSession } = useSessionContext();

  function handleSessionSelect(entry: SessionEntry) {
    switchSession(entry);
    router.push("/dashboard/chat");
  }

  return (
    <SessionSidebar
      currentSessionId={sessionId}
      onNewSession={resetSession}
      onSessionSelect={handleSessionSelect}
    />
  );
}
