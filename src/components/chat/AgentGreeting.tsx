"use client";

import { motion } from "framer-motion";
import { Upload, Calculator, Search, FileOutput } from "lucide-react";

interface AgentGreetingProps {
  userName?: string;
  agentName?: string;
  onQuickAction: (text: string) => void;
}

const QUICK_ACTIONS = [
  {
    icon: Upload,
    label: "Analizar un archivo",
    description: "Subí planos, presupuestos, contratos o fotos de obra",
    prompt: "Quiero subir un archivo para que lo analices. ¿Qué tipos de archivo podés procesar?",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    icon: Calculator,
    label: "Calcular cantidades",
    description: "Estimá materiales, áreas y costos de cualquier proyecto",
    prompt: "Necesito calcular cantidades de materiales y costos para un proyecto de construcción.",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50",
    border: "border-green-200 dark:border-green-800",
  },
  {
    icon: Search,
    label: "Buscar en mis archivos",
    description: "Consultá información de documentos que subiste antes",
    prompt: "Quiero buscar información en los documentos que subí anteriormente. ¿Qué tenés guardado?",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50",
    border: "border-purple-200 dark:border-purple-800",
  },
  {
    icon: FileOutput,
    label: "Generar un documento",
    description: "Cómputos, remitos e informes listos para usar",
    prompt: "Necesito generar un documento para mi obra. Puede ser un cómputo, remito o informe técnico.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50",
    border: "border-orange-200 dark:border-orange-800",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export function AgentGreeting({ userName, agentName = "EdificIA", onQuickAction }: AgentGreetingProps) {
  const firstName = userName?.split(" ")[0];
  const greeting = firstName ? `Hola ${firstName}` : "Bienvenido";

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      >
        <span className="text-2xl font-bold select-none">
          {agentName.charAt(0).toUpperCase()}
        </span>
      </motion.div>

      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="space-y-2"
      >
        <h2 className="text-2xl font-semibold tracking-tight">{greeting}, ¿qué deseás hacer hoy?</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Soy {agentName} — automatizo procesos de obra. Analizá documentos, calculá materiales,
          generá informes y consultá el historial de tu empresa, todo desde acá.
        </p>
      </motion.div>

      {/* Quick action cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid w-full max-w-xl grid-cols-2 gap-2"
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              variants={item}
              onClick={() => onQuickAction(action.prompt)}
              className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors ${action.bg} ${action.border}`}
            >
              <Icon className={`h-4 w-4 ${action.color}`} />
              <span className="text-sm font-semibold text-foreground leading-tight">{action.label}</span>
              <span className="text-[11px] text-muted-foreground leading-snug">{action.description}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* File type hints */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-[11px] text-muted-foreground/60"
      >
        Arrastrá un archivo para empezar · Excel · PDF · DXF · DOCX · Imagen
      </motion.p>
    </div>
  );
}
