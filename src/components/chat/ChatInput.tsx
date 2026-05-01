"use client";

import { useRef, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Square, Paperclip, FileSpreadsheet, FileText, FileCode2, FileType2, Eye, X, Loader2 } from "lucide-react";
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
  excel:           FileSpreadsheet,
  pdf:             FileText,
  dxf:             FileCode2,
  docx:            FileType2,
  image:           FileType2,
  dwg_unsupported: FileCode2,
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

  return (
    <div className="max-w-[720px] mx-auto w-full">
      {/* Composer card */}
      <div className={cn(
        "overflow-hidden rounded-[12px] border border-border bg-card shadow-[var(--shadow-sm)] transition-shadow",
        "focus-within:shadow-[var(--shadow-md)] focus-within:border-primary/40",
        isUploading && "opacity-75",
      )}>

        {/* Attached file strip */}
        {attachedChip && Icon && (
          <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="flex-1 truncate text-xs font-medium text-foreground">{attachedChip.name}</span>
            {attachedChip.subtitle && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{attachedChip.subtitle}</span>
            )}
            {onPreviewDxf && (
              <button
                type="button"
                onClick={onPreviewDxf}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-primary transition-colors"
                title="Ver plano"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
            {onRemoveFile && (
              <button
                type="button"
                onClick={onRemoveFile}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                title="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-2.5">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf,.dxf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.dwg"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isUploading || disabled}
            title="Adjuntar archivo"
            className={cn(
              "h-8 w-8 shrink-0 flex items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              isUploading && "text-primary",
            )}
          >
            {isUploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Paperclip className="h-4 w-4" />
            }
          </button>

          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploading
                ? "Procesando archivo…"
                : attachedChip
                ? "Preguntá algo o dejá vacío para auditar automáticamente…"
                : "Enviá datos o hacé una pregunta…"
            }
            className="min-h-[36px] max-h-[200px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground placeholder:italic"
            rows={1}
            disabled={disabled || isUploading}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="Detener"
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-[6px] bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={(!value.trim() && !attachedChip) || isStreaming || isUploading || disabled}
              title="Enviar"
              className={cn(
                "h-8 w-8 shrink-0 flex items-center justify-center rounded-[6px] transition-colors",
                "bg-primary text-primary-foreground hover:bg-[var(--terra-600)]",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
