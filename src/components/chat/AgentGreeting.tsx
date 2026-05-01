"use client";

import { motion } from "framer-motion";
import { ArrowRight, Upload, Calculator, Search, FileOutput } from "lucide-react";

interface AgentGreetingProps {
  userName?: string;
  onQuickAction: (text: string) => void;
}

const QUICK_PROMPTS = [
  "¿Cómo detecto errores en un presupuesto?",
  "Calculá incidencias por rubro",
  "Comparar dos versiones de un cómputo",
  "Generar un informe ejecutivo de auditoría",
  "¿Qué rubros son más riesgosos en obra gruesa?",
];

const CAPABILITIES = [
  {
    n: "01",
    icon: Upload,
    label: "Analizá documentos",
    desc: "Excel, PDF, DXF, DOCX, imágenes — cargalos y EdificIA los audita automáticamente.",
  },
  {
    n: "02",
    icon: Calculator,
    label: "Calculá cómputos",
    desc: "Estimá materiales, áreas y costos directos con herramientas matemáticas certificadas.",
  },
  {
    n: "03",
    icon: Search,
    label: "Consultá tu historial",
    desc: "Buscá en todos los documentos de tu empresa con búsqueda semántica.",
  },
  {
    n: "04",
    icon: FileOutput,
    label: "Generá informes",
    desc: "Cómputos, auditorías y remitos listos para exportar a PDF o Excel.",
  },
];

const WORKFLOW = [
  { n: "01", label: "Carga", desc: "XLSX · PDF · DXF" },
  { n: "02", label: "Auditoría", desc: "9 reglas · cierre" },
  { n: "03", label: "Cálculo", desc: "incidencias · costos" },
  { n: "04", label: "Reporte", desc: "PDF · XLSX" },
];

export function AgentGreeting({ userName, onQuickAction }: AgentGreetingProps) {
  const firstName = userName?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const fullGreeting = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <div className="flex flex-col items-center px-6 py-12 pb-6">
      <div className="w-full max-w-[680px]">

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-5 flex items-center justify-center gap-3 text-primary"
        >
          <span className="h-px w-4 bg-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            EdificIA · v0.6 · auditoría asistida
          </span>
          <span className="h-px w-4 bg-primary" />
        </motion.div>

        {/* Display headline — Fraunces */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="mb-3 text-center"
        >
          <h1 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-foreground">
            {fullGreeting}
          </h1>
          <h2 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.02em]">
            <em className="not-italic text-primary">¿Qué obra</em>{" "}
            <span className="text-foreground">auditamos hoy?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cargá un presupuesto, plano DXF o memoria descriptiva. EdificIA detecta
            inconsistencias, calcula incidencias y genera informes auditables.
          </p>
        </motion.div>

        {/* Hero dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="relative mt-8 overflow-hidden rounded-[14px] border border-dashed border-primary/40 bg-primary/[0.04] px-8 py-7"
        >
          {/* Corner tick marks */}
          <CornerTicks />

          <div className="flex items-center gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-primary text-primary-foreground shadow-sm">
              <Upload className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Arrastrá tu archivo o{" "}
                <span className="cursor-pointer text-primary underline underline-offset-2">seleccionalo</span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                XLSX · PDF · DXF · DOCX · PNG/JPG &nbsp;·&nbsp; máx. 50 MB
              </p>
            </div>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50 [writing-mode:vertical-rl] sm:block" style={{ transform: "rotate(180deg)" }}>
              INPUT — 01
            </span>
          </div>
        </motion.div>

        {/* Or divider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="my-6 flex items-center gap-3 text-muted-foreground"
        >
          <span className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]">o preguntá directamente</span>
          <span className="h-px flex-1 bg-border" />
        </motion.div>

        {/* Sample prompt chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onQuickAction(p)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3 text-primary" />
              <span>{p}</span>
            </button>
          ))}
        </motion.div>

        {/* Lo que puedo hacer — section with label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10"
        >
          <SectionLabel>Lo que puedo hacer</SectionLabel>
          <div className="mt-3 overflow-hidden rounded-[10px] border border-border bg-card">
            {CAPABILITIES.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.n}
                  className={`flex items-center gap-4 px-4 py-3.5 ${i < CAPABILITIES.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="w-7 font-mono text-[10px] text-muted-foreground/60 shrink-0">{c.n}</span>
                  <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <span className="font-display text-sm font-medium text-foreground">{c.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Pipeline workflow rail */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <SectionLabel>Pipeline</SectionLabel>
          <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-[10px] border border-border bg-card">
            {WORKFLOW.map((s, i) => (
              <div
                key={s.n}
                className={`relative px-4 py-3.5 ${i < WORKFLOW.length - 1 ? "border-r border-border" : ""}`}
              >
                <div className="font-mono text-[10px] tracking-[0.05em] text-primary">{s.n}</div>
                <div className="mt-1 text-[13px] font-semibold text-foreground">{s.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{s.desc}</div>
                {i < WORKFLOW.length - 1 && (
                  <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

/* ── Shared micro-components ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] shrink-0">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function CornerTicks() {
  const c = "stroke-primary";
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {/* TL */}
      <line x1="8" y1="8" x2="18" y2="8" className={c} strokeWidth="1.5" />
      <line x1="8" y1="8" x2="8" y2="18" className={c} strokeWidth="1.5" />
      {/* TR */}
      <line x1="100%" y1="8" x2="calc(100% - 10px)" y2="8" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="8" x2="calc(100% - 8px)" y2="18" className={c} strokeWidth="1.5" />
      {/* BL */}
      <line x1="8" y1="100%" x2="18" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="8" y1="calc(100% - 8px)" x2="8" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
      {/* BR */}
      <line x1="100%" y1="100%" x2="calc(100% - 10px)" y2="100%" className={c} strokeWidth="1.5" />
      <line x1="calc(100% - 8px)" y1="100%" x2="calc(100% - 8px)" y2="calc(100% - 18px)" className={c} strokeWidth="1.5" />
    </svg>
  );
}
