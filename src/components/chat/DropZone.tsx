"use client";

import { useCallback, useState, type ReactNode, type DragEvent } from "react";
import { Upload, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string[];
  canUpload?: boolean;
  children: ReactNode;
}

export function DropZone({
  onFileDrop,
  accept = [".xlsx", ".xls", ".csv", ".pdf", ".dxf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".gif", ".webp"],
  canUpload = true,
  children,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (!canUpload) return;

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (!accept.includes(ext)) return;

      onFileDrop(file);
    },
    [onFileDrop, accept, canUpload],
  );

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* No-permission overlay when viewer drags a file */}
      {isDragging && !canUpload && (
        <div className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
          "border-2 border-dashed border-destructive/40 bg-destructive/5",
        )}>
          <Lock className="h-8 w-8 text-destructive/60" />
          <p className="text-sm font-medium text-destructive/80">
            Acción no permitida
          </p>
          <p className="text-xs text-muted-foreground">
            Tu rol no tiene permisos para subir archivos
          </p>
        </div>
      )}

      {/* Normal drag overlay */}
      {isDragging && canUpload && (
        <div className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
          "border-2 border-dashed border-primary bg-primary/8",
        )}>
          <Upload className="h-10 w-10 text-primary" />
          <p className="text-sm font-medium text-primary">
            Soltá el archivo aquí
          </p>
          <p className="text-xs text-muted-foreground">
            Excel · PDF · DXF · DOCX · Imágenes
          </p>
        </div>
      )}
    </div>
  );
}
