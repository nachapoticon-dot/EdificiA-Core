"use client";

import { useCallback, useState, type ReactNode, type DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const MIME_BY_EXT: Record<string, string[]> = {
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls":  ["application/vnd.ms-excel"],
  ".csv":  ["text/csv", "text/plain", "application/csv"],
  ".pdf":  ["application/pdf"],
  ".dxf":  [],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".doc":  ["application/msword"],
  ".png":  ["image/png"],
  ".jpg":  ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif":  ["image/gif"],
  ".webp": ["image/webp"],
};

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string[];
  canUpload?: boolean;
  children: ReactNode;
}

const overlay = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, scale: 0.98, transition: { duration: 0.1 } },
};

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

      const allowedMimes: string[] = MIME_BY_EXT[ext] ?? [];
      const fileMime = ((file.type || "").split(";")[0] ?? "").trim().toLowerCase();
      if (allowedMimes.length > 0 && fileMime && !allowedMimes.includes(fileMime)) return;

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

      <AnimatePresence>
        {isDragging && !canUpload && (
          <motion.div
            key="no-permission"
            variants={overlay}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
              "border-2 border-dashed border-destructive/50 bg-destructive/8 backdrop-blur-[2px]",
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <Lock className="h-7 w-7 text-destructive/70" />
            </div>
            <p className="text-sm font-semibold text-destructive/80">Acción no permitida</p>
            <p className="text-xs text-muted-foreground">Tu rol no tiene permisos para subir archivos</p>
          </motion.div>
        )}

        {isDragging && canUpload && (
          <motion.div
            key="drop-ready"
            variants={overlay}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
              "border-2 border-dashed border-primary bg-primary/[0.06] backdrop-blur-[2px]",
            )}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
            >
              <Upload className="h-7 w-7 text-primary" />
            </motion.div>
            <p className="text-sm font-semibold text-primary">Soltá el archivo aquí</p>
            <p className="text-xs text-muted-foreground">Excel · PDF · DXF · DOCX · Imágenes</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
