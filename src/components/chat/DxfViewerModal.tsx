"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  blobUrl: string;
  fileName: string;
  onClose: () => void;
}

type ViewerState = "loading" | "ready" | "error";

export function DxfViewerModal({ blobUrl, fileName, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("dxf-viewer").DxfViewer | null>(null);
  const [state, setState] = useState<ViewerState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    let viewer: import("dxf-viewer").DxfViewer | null = null;

    (async () => {
      try {
        const [{ DxfViewer }, { Color }] = await Promise.all([
          import("dxf-viewer"),
          import("three"),
        ]);

        viewer = new DxfViewer(el, {
          autoResize: true,
          blackWhiteInversion: false,
          antialias: true,
          canvasAlpha: false,
          clearColor: new Color(0x1a1a1a),
        });
        viewerRef.current = viewer;

        await viewer.Load({ url: blobUrl, fonts: null, workerFactory: null });

        const bounds = viewer.GetBounds();
        if (bounds) {
          viewer.FitView(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0.1);
        }

        setState("ready");
      } catch (err) {
        console.error("DxfViewer error:", err);
        setErrorMsg(err instanceof Error ? err.message : "Error al renderizar el plano.");
        setState("error");
      }
    })();

    return () => {
      viewer?.Destroy();
      viewerRef.current = null;
    };
  }, [blobUrl]);

  function fitView() {
    const v = viewerRef.current;
    if (!v) return;
    const bounds = v.GetBounds();
    if (bounds) v.FitView(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, 0.1);
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[90vh] w-[90vw] max-w-6xl flex-col rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <span className="text-sm font-semibold truncate flex-1">{fileName}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitView} title="Ajustar vista">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onClose} title="Cerrar">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 overflow-hidden rounded-b-xl bg-[#1a1a1a]">
          {/* WebGL container */}
          <div ref={containerRef} className="h-full w-full" />

          {/* Loading overlay */}
          {state === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando plano DXF…</p>
            </div>
          )}

          {/* Error overlay */}
          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a] px-8 text-center">
              <p className="text-sm font-medium text-destructive">No se pudo renderizar el plano</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
          )}

          {/* Controls hint */}
          {state === "ready" && (
            <div className={cn(
              "absolute bottom-3 left-1/2 -translate-x-1/2",
              "rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] text-white/50",
            )}>
              Scroll para zoom · Arrastrar para mover
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
