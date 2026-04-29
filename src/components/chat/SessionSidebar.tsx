"use client";

import { FileSpreadsheet, FileText, FileCode2, FileType2, Image, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { sessions, clearAll } = useSessionHistory();

  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Historial
        </span>
        {sessions.length > 0 && (
          <button
            onClick={clearAll}
            title="Limpiar historial"
            className="text-muted-foreground/50 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* New session */}
      <Button
        variant="ghost"
        size="sm"
        className="mx-1 justify-start gap-2 text-xs font-medium"
        onClick={onNewSession}
      >
        <Plus className="h-3.5 w-3.5" />
        Nueva auditoría
      </Button>

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
}: {
  entry: SessionEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = entry.fileType ? FILE_ICONS[entry.fileType] : FileText;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{entry.title}</p>
        <p className="text-[10px] opacity-60">{formatRelative(entry.startedAt)}</p>
      </div>
    </button>
  );
}
