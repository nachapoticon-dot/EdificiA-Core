"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  ArrowUp, Square, Paperclip,
  FileSpreadsheet, FileText, FileCode2, FileType2, Eye, X, Loader2,
} from "lucide-react";
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
  canUpload?: boolean;
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
  canUpload = true,
  attachedChip,
  onRemoveFile,
  onPreviewDxf,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && !isUploading && (value.trim() || attachedChip)) onSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { onFileSelect(file); e.target.value = ""; }
  }

  const Icon = attachedChip ? CHIP_ICONS[attachedChip.fileType] : null;
  const canSend = !isStreaming && !isUploading && !disabled && (!!value.trim() || !!attachedChip);

  return (
    <div className={cn(
      "rounded-[14px] border border-border bg-card shadow-sm transition-all duration-150",
      "focus-within:border-primary/40 focus-within:shadow-[0_4px_24px_0_rgb(0_0_0/0.08)]",
      isUploading && "opacity-70",
    )}>

      {/* Attached file chip */}
      {attachedChip && Icon && (
        <div className="flex items-center gap-2.5 border-b border-border/50 bg-muted/40 px-4 py-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
          <span className="flex-1 truncate text-xs font-medium text-foreground">
            {attachedChip.name}
          </span>
          {attachedChip.subtitle && (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {attachedChip.subtitle}
            </span>
          )}
          {onPreviewDxf && (
            <button type="button" onClick={onPreviewDxf} title="Ver plano"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary">
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {onRemoveFile && (
            <button type="button" onClick={onRemoveFile} title="Quitar archivo"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf,.dxf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.dwg"
          onChange={handleFileChange}
        />

        {/* Attach */}
        <button
          type="button"
          onClick={() => canUpload ? fileInputRef.current?.click() : undefined}
          disabled={isStreaming || isUploading || disabled || !canUpload}
          title={canUpload ? "Adjuntar archivo" : "No tenés permisos para adjuntar archivos"}
          className={cn(
            "shrink-0 flex h-7 w-7 items-center justify-center rounded-lg",
            "text-muted-foreground/60 transition-colors",
            canUpload
              ? "hover:bg-primary/[0.07] hover:text-primary"
              : "cursor-not-allowed opacity-30",
            "disabled:pointer-events-none disabled:opacity-40",
            isUploading && "text-primary",
          )}
        >
          {isUploading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Paperclip className="h-4 w-4" />
          }
        </button>

        {/* Native textarea — avoids the Textarea component's min-h-16 base class */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isUploading      ? "Procesando archivo…"
            : attachedChip   ? "Preguntá algo o dejá vacío para auditar…"
            :                  "Enviá datos o hacé una pregunta…"
          }
          rows={1}
          disabled={disabled || isUploading}
          className="field-sizing-content flex-1 resize-none bg-transparent py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground/55 disabled:opacity-50"
        />

        {/* Stop / Send */}
        {isStreaming ? (
          <button type="button" onClick={onStop} title="Detener"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground/70 transition-colors hover:bg-accent">
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={!canSend} title="Enviar"
            className={cn(
              "shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-100",
              "bg-primary text-primary-foreground",
              "hover:opacity-90 active:scale-[0.92]",
              "disabled:cursor-not-allowed disabled:opacity-25 disabled:active:scale-100",
            )}>
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
