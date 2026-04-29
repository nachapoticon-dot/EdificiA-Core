"use client";

import { useRef, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Square, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onFileSelect: (file: File) => void;
  isStreaming: boolean;
  isUploading: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onFileSelect,
  isStreaming,
  isUploading,
  disabled,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && !isUploading && value.trim()) onSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
      />

      {/* Attach button */}
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
        title="Adjuntar Excel"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isUploading ? "Procesando archivo…" : "Enviá datos del presupuesto o hacé una pregunta…"}
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
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon"
          onClick={onSubmit}
          disabled={!value.trim() || isStreaming || isUploading || disabled}
          className="h-9 w-9 shrink-0"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
