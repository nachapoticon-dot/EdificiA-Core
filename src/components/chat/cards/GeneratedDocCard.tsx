"use client";

import { useState } from "react";
import { FileSpreadsheet, FileType2, FileText, FileSignature, ClipboardList, Download, CheckCircle2, AlertCircle, Wand2, X } from "lucide-react";
import { getAuthHeaders } from "@/lib/insforge/client";

export interface DocGenerationProposal {
  type: "doc_generation_proposal";
  docType: "presupuesto_excel" | "memoria_descriptiva" | "informe_pdf" | "orden_compra" | "acta_obra";
  fileName: string;
  description: string;
  payload: Record<string, unknown>;
  organizationId: string;
}

const DOC_CONFIG = {
  presupuesto_excel: {
    Icon: FileSpreadsheet,
    color: "text-[var(--ok)]",
    ext: ".xlsx",
    apiRoute: "/api/generate/presupuesto",
    label: "Presupuesto Excel",
  },
  memoria_descriptiva: {
    Icon: FileType2,
    color: "text-[var(--cyan)]",
    ext: ".docx",
    apiRoute: "/api/generate/memoria",
    label: "Memoria Descriptiva",
  },
  informe_pdf: {
    Icon: FileText,
    color: "text-[var(--err)]",
    ext: ".pdf",
    apiRoute: "/api/generate/informe",
    label: "Informe de Auditoría",
  },
  orden_compra: {
    Icon: FileSignature,
    color: "text-[var(--warn)]",
    ext: ".docx",
    apiRoute: "/api/generate/orden-compra",
    label: "Orden de Compra",
  },
  acta_obra: {
    Icon: ClipboardList,
    color: "text-primary",
    ext: ".docx",
    apiRoute: "/api/generate/acta-obra",
    label: "Parte Diario de Obra",
  },
} as const;

interface GeneratedDocCardProps {
  proposal: DocGenerationProposal;
  /** Called when user requests adjustments. The chat page handles re-prompting the agent. */
  onAdjust?: (proposal: DocGenerationProposal, instructions: string) => void;
}

export function GeneratedDocCard({ proposal, onAdjust }: GeneratedDocCardProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustText, setAdjustText] = useState("");
  const cfg = DOC_CONFIG[proposal.docType];
  const { Icon } = cfg;
  const fileName = `${proposal.fileName}${cfg.ext}`;

  async function handleDownload() {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(cfg.apiRoute, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ ...proposal.payload, fileName: proposal.fileName }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setErrorMsg(null); }, 4000);
    }
  }

  function handleAdjustSubmit() {
    const instr = adjustText.trim();
    if (!instr || !onAdjust) return;
    onAdjust(proposal, instr);
    setAdjustText("");
    setAdjustOpen(false);
  }

  return (
    <div className="my-2 overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_4%,transparent)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-muted ${cfg.color}`}>
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{fileName}</p>
          <p className="text-[11px] text-muted-foreground">{proposal.description}</p>
        </div>
        <span className={`shrink-0 rounded-[6px] bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-2.5">
        <button
          onClick={handleDownload}
          disabled={status === "loading" || status === "done"}
          className="flex items-center gap-2 rounded-[8px] bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          )}
          {status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {status === "error" && <AlertCircle className="h-3.5 w-3.5" />}
          {status === "idle" && <Download className="h-3.5 w-3.5" />}
          {status === "idle" && "Descargar"}
          {status === "loading" && "Generando…"}
          {status === "done" && "Descargado"}
          {status === "error" && "Error — reintentar"}
        </button>

        {onAdjust && status !== "loading" && (
          <button
            onClick={() => setAdjustOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-[8px] border border-border bg-background px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Ajustar
          </button>
        )}

        {errorMsg && (
          <span className="font-mono text-[10px] text-[var(--err)]">{errorMsg}</span>
        )}
      </div>

      {/* Adjust input */}
      {adjustOpen && onAdjust && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            ¿Qué querés cambiar?
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={adjustText}
              onChange={(e) => setAdjustText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdjustSubmit();
                if (e.key === "Escape") setAdjustOpen(false);
              }}
              placeholder="Ej: agregá una sección de exclusiones, cambiá el rubro 3 a $850.000…"
              className="flex-1 rounded-[8px] border border-input bg-background px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
            />
            <button
              onClick={handleAdjustSubmit}
              disabled={!adjustText.trim()}
              className="rounded-[8px] bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Pedir cambio
            </button>
            <button
              onClick={() => { setAdjustOpen(false); setAdjustText(""); }}
              className="flex items-center justify-center rounded-[8px] border border-foreground/15 px-2 text-muted-foreground hover:text-foreground"
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
