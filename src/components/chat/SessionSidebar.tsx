"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, FileCode2, FileType2, Image, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import type { SessionEntry } from "@/hooks/useSessionHistory";
import { cn } from "@/lib/utils";

const FILE_ICONS = {
  excel: FileSpreadsheet,
  pdf: FileText,
  dxf: FileCode2,
  docx: FileType2,
  image: Image,
} as const;

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

interface Props {
  currentSessionId: string | null;
  onNewSession: () => void;
  onSessionSelect: (entry: SessionEntry) => void;
}

export function SessionSidebar({ currentSessionId, onNewSession, onSessionSelect }: Props) {
  const { sessions, clearAll, deleteSession } = useSessionHistory();

  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Historial
        </span>
        {sessions.length > 0 && (
          <button
            onClick={clearAll}
            title="Limpiar todo el historial"
            className="text-muted-foreground/40 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* New session */}
      <button
        onClick={onNewSession}
        className="mx-1 flex items-center gap-2 rounded-[8px] border border-dashed border-primary/40 px-3 py-2 text-xs font-medium text-primary/80 transition-colors hover:border-primary hover:bg-primary/[0.04] hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Nueva conversación
      </button>

      {/* Session list */}
      {sessions.length > 0 && (
        <ScrollArea className="max-h-60">
          <div className="space-y-0.5 px-1">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                entry={s}
                isActive={s.id === currentSessionId}
                onClick={() => onSessionSelect(s)}
                onDelete={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                  // If deleting the active session, start a new one
                  if (s.id === currentSessionId) onNewSession();
                }}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function SessionItem({
  entry,
  isActive,
  onClick,
  onDelete,
}: {
  entry: SessionEntry;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const Icon = entry.fileType ? FILE_ICONS[entry.fileType] : FileText;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 text-xs transition-colors text-left",
        isActive
          ? "border-l-2 border-l-primary bg-primary/[0.06] text-foreground pl-[6px]"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{entry.title}</p>
        <p className="text-[10px] opacity-60">{formatRelative(entry.startedAt)}</p>
      </div>
      {/* Delete button — visible on hover */}
      {hovered && (
        <span
          role="button"
          onClick={onDelete}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Eliminar conversación"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}
