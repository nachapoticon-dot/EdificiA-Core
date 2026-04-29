"use client";

import { FileSpreadsheet, FileText, FileCode2, FileType2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProcessedFile } from "@/lib/file-processor/types";

interface FileCardProps {
  file: ProcessedFile;
  onRemove: () => void;
}

const TYPE_CONFIG = {
  excel: { icon: FileSpreadsheet, label: "Planilla Excel", color: "text-green-600" },
  pdf: { icon: FileText, label: "Documento PDF", color: "text-red-500" },
  dxf: { icon: FileCode2, label: "Plano DXF (CAD)", color: "text-blue-500" },
  docx: { icon: FileType2, label: "Documento Word", color: "text-blue-700" },
  image: { icon: FileType2, label: "Imagen", color: "text-purple-500" },
  dwg_unsupported: { icon: FileCode2, label: "DWG no soportado", color: "text-orange-500" },
} satisfies Record<ProcessedFile["type"], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }>;

export function FileCard({ file, onRemove }: FileCardProps) {
  const config = TYPE_CONFIG[file.type];
  const Icon = config.icon;

  const subtitle = getSubtitle(file);

  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <Icon className={`h-8 w-8 shrink-0 ${config.color}`} />

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{file.fileName}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>{config.label}</span>
          {subtitle && <span className="text-foreground">· {subtitle}</span>}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function getSubtitle(file: ProcessedFile): string | null {
  switch (file.type) {
    case "excel":
      return `${file.itemCount} ítems${file.detectedTotal != null ? ` · $${file.detectedTotal.toLocaleString("es-AR")}` : ""}`;
    case "pdf":
      return `${file.pageCount} pág${file.isScanned ? " · escaneado" : ""}`;
    case "dxf":
      return `${file.layers.length} capas · ${Object.values(file.entitySummary).reduce((a, b) => a + b, 0)} entidades`;
    case "docx":
      return `${file.wordCount.toLocaleString()} palabras`;
    default:
      return null;
  }
}
