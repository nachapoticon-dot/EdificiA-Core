"use client";

import { useRef, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Square, Paperclip, FileSpreadsheet, FileText, FileCode2, FileType2, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachedChip {
  name: string;
  subtitle: string;
  fileType: "excel" | "pdf" | "dxf" | "docx" | "image" | "dwg_unsupported";
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onFileSelect: (file: File) => void;
  isStreaming: boolean;
  isUploading: boolean;
  disabled?: boolean;
  attachedChip?: AttachedChip | null;
  onRemoveFile?: () => void;
  onPreviewDxf?: () => void;
}

const CHIP_ICONS = {
  excel:          FileSpreadsheet,
  pdf:            FileText,
  dxf:            FileCode2,
  docx:           FileType2,
  image:          FileType2,
  dwg_unsupported: FileCode2,
};

const CHIP_COLORS = {
  excel:          "text-green-600",
  pdf:            "text-red-500",
  dxf:            "text-blue-500",
  docx:           "text-blue-700",
  image:          "text-purple-500",
  dwg_unsupported: "text-orange-500",
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onFileSelect,
  isStreaming,
  isUploading,
  disabled,
  attachedChip,
  onRemoveFile,
  onPreviewDxf,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const canSend = !isStreaming && !isUploading && (value.trim() || attachedChip);
      if (canSend) onSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = "";
    }
  }

  const Icon = attachedChip ? CHIP_ICONS[attachedChip.fileType] : null;
  const iconColor = attachedChip ? CHIP_COLORS[attachedChip.fileType] : "";

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary/30",
      isUploading && "opacity-80",
    )}>
      {/* File chip — shown inside the box when a file is ready */}
      {attachedChip && Icon && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <span className="flex-1 truncate text-xs font-medium">{attachedChip.name}</span>
          {attachedChip.subtitle && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{attachedChip.subtitle}</span>
          )}
          {onPreviewDxf && (
            <button
              type="button"
              onClick={onPreviewDxf}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-blue-500"
              title="Ver plano"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemoveFile && (
            <button
              type="button"
              onClick={onRemoveFile}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
              title="Quitar archivo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 p-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf,.dxf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.dwg"
          onChange={handleFileChange}
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isUploading || disabled}
          className={cn(
            "h-9 w-9 shrink-0 text-muted-foreground",
            isUploading && "animate-pulse text-primary",
          )}
          title="Adjuntar archivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isUploading
              ? "Procesando archivo…"
              : attachedChip
              ? "Preguntá algo sobre el archivo o dejá vacío para auditar automáticamente…"
              : "Enviá datos o hacé una pregunta…"
          }
          className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm"
          rows={1}
          disabled={disabled || isUploading}
        />

        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onStop}
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            title="Detener"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={(!value.trim() && !attachedChip) || isStreaming || isUploading || disabled}
            className="h-9 w-9 shrink-0"
            title="Enviar"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
