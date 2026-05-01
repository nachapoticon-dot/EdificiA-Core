"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, X, Eye } from "lucide-react";

export interface FileProposal {
  fileName: string;
  content: string;
  contentType: string;
  description: string;
  organizationId: string;
}

interface DocumentProposalCardProps {
  proposal: FileProposal;
  onDecision: (accepted: boolean, finalName?: string) => void;
}

export function DocumentProposalCard({ proposal, onDecision }: DocumentProposalCardProps) {
  const [name, setName] = useState(proposal.fileName);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          fileName: name,
          content: proposal.content,
          contentType: proposal.contentType,
          organizationId: proposal.organizationId,
        }),
      });
      setDone(true);
      onDecision(true, name);
    } catch {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2.5 rounded-[10px] border border-[var(--ok)]/30 bg-[var(--ok)]/5 px-4 py-3"
      >
        <CheckCircle2 className="h-4 w-4 text-[var(--ok)] shrink-0" />
        <span className="text-sm text-foreground">
          <span className="font-semibold">{name}</span>{" "}
          <span className="text-muted-foreground">guardado en la base documental.</span>
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full max-w-[520px] overflow-hidden rounded-[14px] border border-primary/30 bg-primary/[0.04]"
    >
      <CornerTicks />

      {/* Header strip */}
      <div className="flex items-center gap-2.5 border-b border-primary/20 px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
          Propuesta de archivo · requiere aprobación
        </span>
      </div>

      {/* Body — two columns: mini preview + form */}
      <div className="flex gap-5 p-4">

        {/* Left: miniature page preview */}
        <div
          className="shrink-0 overflow-hidden rounded-[6px] border border-border bg-card shadow-[var(--shadow-sm)]"
          style={{ width: 88, height: 118 }}
        >
          {/* Terracotta heading bar */}
          <div className="h-[6px] w-full bg-primary" />
          {/* Mock title lines */}
          <div className="px-2 pt-2 pb-1 space-y-1.5">
            <div className="h-[6px] w-10/12 rounded-sm bg-foreground/20" />
            <div className="h-[4px] w-6/12 rounded-sm bg-foreground/10" />
          </div>
          <div className="mx-2 my-1 h-px bg-border" />
          {/* Fake text lines */}
          <div className="px-2 space-y-[4px] mt-1">
            {[12, 10, 11, 10, 12, 9, 11].map((w, i) => (
              <div key={i} className="h-[3px] rounded-sm bg-foreground/10" style={{ width: `${w * 7}%` }} />
            ))}
          </div>
          {/* Mini bar chart at bottom */}
          <div className="mx-2 mt-2 flex items-end gap-[2px]" style={{ height: 14 }}>
            {[40, 60, 35, 80, 50, 30, 70, 45, 55, 25].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${h}%`,
                  background: i === 3 ? "var(--warn)" : "var(--terra-500)",
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
          {/* Page count */}
          <div className="mt-1 px-2 text-right font-mono text-[7px] text-muted-foreground">1/4</div>
        </div>

        {/* Right: form */}
        <div className="flex flex-1 flex-col gap-3 min-w-0">
          {/* Filename input */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Nombre del archivo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-[6px] border border-border bg-card px-3 py-1.5 font-mono text-[12px] text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              spellCheck={false}
            />
          </div>

          {/* Metadata */}
          <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
            {proposal.contentType}
            {proposal.description ? ` · ${proposal.description}` : ""}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-auto">
            <button
              onClick={handleAccept}
              disabled={saving || !name.trim()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saving ? "Guardando…" : "Guardar en proyecto"}
            </button>
            <button
              onClick={() => {
                const blob = new Blob([proposal.content], { type: proposal.contentType });
                window.open(URL.createObjectURL(blob), "_blank");
              }}
              className="flex items-center justify-center rounded-[8px] border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title="Vista previa"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDecision(false)}
              disabled={saving}
              className="flex items-center justify-center rounded-[8px] border border-border p-2 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              title="Descartar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CornerTicks() {
  const c = "stroke-primary/50";
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <line x1="8" y1="8" x2="18" y2="8" className={c} strokeWidth="1.5" />
      <line x1="8" y1="8" x2="8" y2="18" className={c} strokeWidth="1.5" />
      <line x1="100%" y1="8" x2="calc(100% - 10px)" y2="8" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="8" x2="calc(100% - 8px)" y2="18" className={c} strokeWidth="1.5" />
      <line x1="8" y1="100%" x2="18" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="8" y1="calc(100% - 8px)" x2="8" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
      <line x1="100%" y1="100%" x2="calc(100% - 10px)" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="100%" x2="calc(100% - 8px)" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
    </svg>
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getInsForgeClient } = await import("@/lib/insforge/client");
    const all = getInsForgeClient().getHttpClient().getHeaders();
    return all.Authorization ? { Authorization: all.Authorization } : {};
  } catch {
    return {};
  }
}
