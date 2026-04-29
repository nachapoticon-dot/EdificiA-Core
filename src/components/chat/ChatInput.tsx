"use client";

import { useRef, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) onSubmit();
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enviá datos del presupuesto o hacé una pregunta…"
        className={cn(
          "min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm",
        )}
        rows={1}
        disabled={disabled}
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
          disabled={!value.trim() || disabled}
          className="h-9 w-9 shrink-0"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
