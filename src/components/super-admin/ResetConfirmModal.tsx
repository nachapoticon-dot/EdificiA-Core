"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface ResetConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  expected: string;
  expectedHint?: string;
  destructiveLabel?: string;
  busy?: boolean;
  log?: string[] | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const FIELD = "w-full rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-destructive/60 focus:ring-2 focus:ring-destructive/20";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";

export function ResetConfirmModal(props: ResetConfirmModalProps) {
  if (!props.open) return null;
  return <ResetConfirmModalInner {...props} />;
}

function ResetConfirmModalInner({
  title,
  description,
  expected,
  expectedHint,
  destructiveLabel = "Borrar",
  busy = false,
  log = null,
  onConfirm,
  onClose,
}: Omit<ResetConfirmModalProps, "open">) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const matches = value.trim() === expected.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[10px] border border-destructive/30 bg-card shadow-[var(--shadow-md)]">
        <header className="flex items-start justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-5 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <p className="text-[14px] font-semibold text-destructive">{title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-[13px] leading-6 text-foreground">{description}</p>

          <div className="space-y-1.5">
            <label className={LABEL}>
              Escribí <span className="font-mono text-foreground">{expected}</span> para confirmar
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && matches && !busy) void onConfirm(); }}
              placeholder={expected}
              className={FIELD}
              disabled={busy}
              autoComplete="off"
            />
            {expectedHint && <p className="text-[11px] text-muted-foreground">{expectedHint}</p>}
          </div>

          {log && log.length > 0 && (
            <pre className="max-h-40 overflow-y-auto rounded-[6px] border border-border bg-background p-2.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
              {log.join("\n")}
            </pre>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-background/50 px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => { void onConfirm(); }}
            disabled={!matches || busy}
            className="flex items-center gap-1.5 rounded-[8px] border border-destructive bg-destructive/90 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {destructiveLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
