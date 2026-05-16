"use client";

import { notFound } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ResponseBlock } from "@/components/chat/blocks";
import {
  DEMO_METRICS,
  DEMO_MEDIA,
  DEMO_COMPARISON,
  DEMO_TIMELINE,
} from "@/components/chat/blocks/demo-data";
import type { BlockSpec } from "@/lib/validators/blocks";
import { CheckCircle2, Dot, Wrench, Sparkles } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// /dashboard/blocks-demo — reproduce la conversación scripteada que prueba
// los 4 bloques con sus skeletons. Pensada para QA visual / Storybook backup.
// Borrar antes de mergear a main si no la querés en producción.
// ─────────────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  time: string;
  text?: string;
  tools?: string[];
  block?: BlockSpec;
};

const TOOL_LABELS: Record<string, string> = {
  calcular_totales: "Calculando totales del presupuesto",
  calcular_incidencia_de_subgrupo: "Calculando incidencia por rubro",
  comparar_con_indices: "Comparando contra índices CAC abr-2026",
  buscar_en_base_documental: "Buscando en legajo técnico",
  analizar_geometria_plano: "Analizando geometría del plano",
  comparar_presupuestos: "Cotejando proveedores",
  analizar_estado_obra: "Analizando estado de obra",
};

const CONVERSATION: Message[] = [
  { id: "u1", role: "user", time: "09:14",
    text: "Auditá el presupuesto del torre A. Quiero ver incidencia por rubro y dónde nos pasamos del índice CAC." },
  { id: "a1", role: "assistant", time: "09:14",
    tools: ["calcular_totales", "calcular_incidencia_de_subgrupo", "comparar_con_indices"],
    text: "Audité **247 ítems**. Concentración en Estructura (38.4%) y Mampostería (14.2%). **Atención**: Inst. sanitarias 11% por encima del CAC abr-2026.",
    block: DEMO_METRICS },

  { id: "u2", role: "user", time: "09:21",
    text: "Mostrame los planos vigentes y la última inspección del subsuelo." },
  { id: "a2", role: "assistant", time: "09:21",
    tools: ["buscar_en_base_documental", "analizar_geometria_plano"],
    text: "**6 documentos vigentes** asociados a Las Lomas. Te dejo planos R7 + render fachada + 12 fotos del subsuelo del 09/05.",
    block: DEMO_MEDIA },

  { id: "u3", role: "user", time: "09:33",
    text: "Compará proveedores de hormigón H21 para la próxima colada (220 m³)." },
  { id: "a3", role: "assistant", time: "09:33",
    tools: ["buscar_en_base_documental", "comparar_presupuestos"],
    text: "Ranking de **4 proveedores** con stock semana 19. *Hormigonera del Sur* combina mejor precio + plazo 24h + IRAM vigente.",
    block: DEMO_COMPARISON },

  { id: "u4", role: "user", time: "09:41",
    text: "¿Cómo viene el cronograma? Quiero ver dónde estamos parados y los próximos hitos." },
  { id: "a4", role: "assistant", time: "09:41",
    tools: ["analizar_estado_obra"],
    text: "Avance al **día 132 de 220** (60%). Estructura cerró 4d adelantada. Hito crítico: **certificación intermedia en 14 días**.",
    block: DEMO_TIMELINE },
];

type BlockState = "tools" | "skeleton" | "ready";

export default function BlocksDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const [visible, setVisible] = useState<string[]>([]);
  const [blockState, setBlockState] = useState<Record<string, BlockState>>({});
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setVisible([]);
      setBlockState({});
      for (let i = 0; i < CONVERSATION.length; i++) {
        const msg = CONVERSATION[i];
        if (!msg) continue;
        await sleep(i === 0 ? 200 : 700);
        if (cancelled) return;
        setVisible((v) => [...v, msg.id]);

        if (msg.role === "assistant") {
          if (msg.tools) {
            setBlockState((s) => ({ ...s, [msg.id]: "tools" }));
            await sleep(1200);
            if (cancelled) return;
          }
          if (msg.block) {
            setBlockState((s) => ({ ...s, [msg.id]: "skeleton" }));
            await sleep(1400);
            if (cancelled) return;
            setBlockState((s) => ({ ...s, [msg.id]: "ready" }));
          }
        }

        requestAnimationFrame(() =>
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
        );
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-2.5">
        <div className="text-[12.5px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">DEMO ›</span>{" "}
          <strong>Bloques de Respuesta · Las Lomas — Torre A</strong>
        </div>
        <button
          type="button"
          onClick={() => setTick((x) => x + 1)}
          className="flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11.5px] font-medium hover:bg-accent"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> Reproducir
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {CONVERSATION.filter((m) => visible.includes(m.id)).map((m) => (
          <Bubble key={m.id} msg={m} state={blockState[m.id]} />
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg, state }: { msg: Message; state?: BlockState }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex animate-in fade-in slide-in-from-bottom-1 gap-3 px-6 py-2 duration-200 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-[8px] bg-primary font-serif text-[15px] italic text-primary-foreground">
          E
        </div>
      )}
      <div className={`flex max-w-[78%] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        <span className="font-mono text-[10px] text-muted-foreground">
          {isUser ? "vos" : "EdificIA"} · {msg.time}
        </span>
        {msg.text && (
          <div className={isUser
            ? "rounded-[12px_12px_2px_12px] bg-foreground px-3.5 py-2 text-[13px] font-medium text-background"
            : "rounded-[2px_12px_12px_12px] border border-border bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground"}>
            {parseInline(msg.text)}
          </div>
        )}
        {!isUser && msg.tools && state && (
          <div className="w-full max-w-[460px] overflow-hidden rounded-[10px] border border-border bg-card">
            {msg.tools.map((t, i) => (
              <div key={t} className={`flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11.5px] last:border-b-0 ${state !== "tools" ? "opacity-65" : ""}`}>
                {state !== "tools"
                  ? <CheckCircle2 className="h-3 w-3 text-[var(--green)]" strokeWidth={1.5} />
                  : <Dot className="h-3 w-3 animate-pulse text-primary" />}
                <Wrench className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="flex-1 text-muted-foreground">{TOOL_LABELS[t] ?? t}</span>
                <span className={`font-mono text-[10px] ${state !== "tools" ? "text-[var(--green)]" : "animate-pulse text-primary"}`}>
                  {state !== "tools" ? "ok" : "en curso…"}
                </span>
              </div>
            ))}
          </div>
        )}
        {!isUser && msg.block && state !== "tools" && state && (
          state === "skeleton"
            ? <ResponseBlock kind={msg.block.kind} loading />
            : <ResponseBlock spec={msg.block} />
        )}
      </div>
    </div>
  );
}

function parseInline(text: string) {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={m.index}>{t.slice(2, -2)}</strong> : <em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
