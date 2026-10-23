"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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
