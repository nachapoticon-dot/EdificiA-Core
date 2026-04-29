"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { Bot, Sparkles } from "lucide-react";

export default function ChatPage() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  function handleSubmit() {
    if (!input.trim() || isStreaming) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b px-6 py-3.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Auditoría IA</h1>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          claude-sonnet-4-6
        </span>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="pb-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          isStreaming={isStreaming}
        />
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">Gemini Construcción listo</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Pegá los datos de tu presupuesto o hacé una pregunta sobre costos,
          incidencias o cierres contables.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <span
            key={s}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Auditá este presupuesto",
  "¿Cierra el total?",
  "Calculá la incidencia de subcontratos",
  "Detectá errores lógicos",
];
