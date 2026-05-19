"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, FileCode2, FileType2, X, CheckCircle2, Eye, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { ProcessedFile } from "@/lib/file-processor/types";

interface FileCardProps {
  file: ProcessedFile;
  onRemove: () => void;
  onPreview?: () => void;
}

const TYPE_CONFIG = {
  excel:         { icon: FileSpreadsheet, label: "Planilla Excel",    color: "text-[oklch(0.58_0.15_145)]",  dot: "bg-[oklch(0.58_0.15_145)]"  },
  pdf:           { icon: FileText,        label: "Documento PDF",     color: "text-[oklch(0.55_0.18_25)]",   dot: "bg-[oklch(0.55_0.18_25)]"   },
  dxf:           { icon: FileCode2,       label: "Plano DXF (CAD)",   color: "text-[oklch(0.58_0.14_240)]",  dot: "bg-[oklch(0.58_0.14_240)]"  },
  docx:          { icon: FileType2,       label: "Documento Word",    color: "text-[oklch(0.52_0.18_260)]",  dot: "bg-[oklch(0.52_0.18_260)]"  },
  image:         { icon: FileType2,       label: "Imagen",            color: "text-[oklch(0.58_0.16_310)]",  dot: "bg-[oklch(0.58_0.16_310)]"  },
  dwg_unsupported: { icon: FileCode2,     label: "DWG no soportado",  color: "text-[oklch(0.62_0.14_60)]",   dot: "bg-[oklch(0.62_0.14_60)]"   },
} satisfies Record<ProcessedFile["type"], { icon: React.ComponentType<{ className?: string }>; label: string; color: string; dot: string }>;

export function FileCard({ file, onRemove, onPreview }: FileCardProps) {
  const config = TYPE_CONFIG[file.type];
  const Icon = config.icon;
  const meta = getMetaItems(file);

  return (
    <div className="mx-4 mb-2 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      {/* Icon */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background ${config.color}`}>
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground">{file.fileName}</p>

        {/* Status row */}
        <div className="mt-0.5 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-[oklch(0.58_0.15_145)]" />
          <span className="text-[11px] text-muted-foreground">{config.label}</span>
        </div>

        {/* Metadata chips */}
        {meta.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meta.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        {onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-blue-500"
            onClick={onPreview}
            title="Ver plano"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Upload progress card ──────────────────────────────────────────────────────

const STAGES = [
  { label: "Subiendo archivo",          detail: "Transfiriendo al servidor…"                   },
  { label: "Procesando contenido",      detail: "Extrayendo texto, tablas y geometrías…"       },
  { label: "Preparando fuente empresarial", detail: "Dejando la evidencia disponible para búsqueda y perfil…" },
];

export function UploadProgressCard() {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStageIdx(1), 1400);
    const t2 = setTimeout(() => setStageIdx(2), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const stage = STAGES[stageIdx]!;

  return (
    <div className="mx-4 mb-2 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground">{stage.label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{stage.detail}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-primary/70"
            initial={{ width: "4%" }}
            animate={{ width: stageIdx === 0 ? "28%" : stageIdx === 1 ? "66%" : "88%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="mt-1.5 flex gap-2">
          {STAGES.map((s, i) => (
            <span
              key={i}
              className="font-mono text-[9px] tracking-[0.06em] transition-colors duration-300"
              style={{ color: i <= stageIdx ? "var(--primary)" : "var(--muted-foreground)", opacity: i <= stageIdx ? 1 : 0.45 }}
            >
              {i + 1}. {s.label.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function getMetaItems(file: ProcessedFile): string[] {
  switch (file.type) {
    case "excel": {
      const items: string[] = [];
      if (file.itemCount) items.push(`${file.itemCount} ítems`);
      if (file.sheetName) items.push(`hoja "${file.sheetName}"`);
      if (file.detectedTotal != null) items.push(`$${file.detectedTotal.toLocaleString("es-AR")}`);
      return items;
    }
    case "pdf":
      return [
        `${file.pageCount} pág`,
        ...(file.isScanned ? ["escaneado"] : []),
      ];
    case "dxf":
      return [
        `${file.layers.length} capas`,
        `${Object.values(file.entitySummary).reduce((a, b) => a + b, 0)} entidades`,
      ];
    case "docx":
      return [`${file.wordCount.toLocaleString()} palabras`];
    default:
      return [];
  }
}
