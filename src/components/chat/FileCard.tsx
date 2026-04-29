"use client";

import { FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileCardProps {
  fileName: string;
  sheetName: string;
  itemCount: number;
  detectedTotal: number | null;
  onRemove: () => void;
}

export function FileCard({
  fileName,
  sheetName,
  itemCount,
  detectedTotal,
  onRemove,
}: FileCardProps) {
  return (
    <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" />

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{fileName}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>
            {itemCount} ítems extraídos · Hoja: {sheetName}
          </span>
          {detectedTotal != null && (
            <span className="text-foreground font-medium">
              · Total: ${detectedTotal.toLocaleString("es-AR")}
            </span>
          )}
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
