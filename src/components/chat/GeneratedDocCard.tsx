"use client";

import { useState } from "react";
import { FileSpreadsheet, FileType2, FileText, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { getInsForgeClient } from "@/lib/insforge/client";

export interface DocGenerationProposal {
  type: "doc_generation_proposal";
  docType: "presupuesto_excel" | "memoria_descriptiva" | "informe_pdf";
  fileName: string;
  description: string;
  payload: Record<string, unknown>;
  organizationId: string;
}

function getAuthHeader(): string {
  const h = getInsForgeClient().getHttpClient().getHeaders() as Record<string, string>;
  return h["Authorization"] ?? "";
}

const DOC_CONFIG = {
  presupuesto_excel: {
    Icon: FileSpreadsheet,
    color: "text-[var(--ok)]",
    bg: "bg-[oklch(0.96_0.05_145)]",
    border: "border-[oklch(0.86_0.1_145)]",
    ext: ".xlsx",
    apiRoute: "/api/generate/presupuesto",
    label: "Presupuesto Excel",
  },
  memoria_descriptiva: {
    Icon: FileType2,
    color: "text-[oklch(0.55_0.16_245)]",
    bg: "bg-[oklch(0.96_0.04_245)]",
    border: "border-[oklch(0.86_0.08_245)]",
    ext: ".docx",
    apiRoute: "/api/generate/memoria",
    label: "Memoria Descriptiva",
  },
  informe_pdf: {
    Icon: FileText,
    color: "text-[var(--err)]",
    bg: "bg-[oklch(0.97_0.03_25)]",
    border: "border-[oklch(0.88_0.07_25)]",
    ext: ".pdf",
    apiRoute: "/api/generate/informe",
    label: "Informe de Auditoría",
  },
} as const;

export function GeneratedDocCard({ proposal }: { proposal: DocGenerationProposal }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const cfg = DOC_CONFIG[proposal.docType];
  const { Icon } = cfg;
  const fileName = `${proposal.fileName}${cfg.ext}`;

  async function handleDownload() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch(cfg.apiRoute, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify({ ...proposal.payload, fileName: proposal.fileName }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className={`my-2 overflow-hidden rounded-[12px] border ${cfg.border} ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/60 ${cfg.color}`}>
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{fileName}</p>
          <p className="text-[11px] text-muted-foreground">{proposal.description}</p>
        </div>
        <span className={`shrink-0 rounded-[6px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cfg.color} bg-white/50`}>
          {cfg.label}
        </span>
      </div>

      {/* Action */}
      <div className="border-t border-white/50 px-4 py-2.5">
        <button
          onClick={handleDownload}
          disabled={status === "loading" || status === "done"}
          className="flex items-center gap-2 rounded-[8px] bg-foreground px-4 py-2 text-[12px] font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {status === "loading" && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" />
          )}
          {status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {status === "error" && <AlertCircle className="h-3.5 w-3.5" />}
          {status === "idle" && <Download className="h-3.5 w-3.5" />}
          {status === "idle" && "Descargar"}
          {status === "loading" && "Generando…"}
          {status === "done" && "Descargado"}
          {status === "error" && "Error — reintentar"}
        </button>
      </div>
    </div>
  );
}
