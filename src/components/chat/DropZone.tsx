"use client";

import { useCallback, useState, type ReactNode, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string[];
  children: ReactNode;
}

export function DropZone({ onFileDrop, accept = [".xlsx", ".xls", ".csv"], children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide overlay when leaving the outer div
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      if (!accept.includes(ext)) return;

      onFileDrop(file);
    },
    [onFileDrop, accept],
  );

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className={cn(
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
          "rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm",
        )}>
          <Upload className="h-10 w-10 text-primary" />
          <p className="text-sm font-medium text-primary">
            Soltá el archivo Excel aquí
          </p>
          <p className="text-xs text-muted-foreground">
            {accept.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
