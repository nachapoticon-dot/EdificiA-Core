"use client";

import { motion } from "framer-motion";
import { FileSpreadsheet, Map, BarChart3, Clock } from "lucide-react";

interface AgentGreetingProps {
  userName?: string;
  agentName?: string;
  onQuickAction: (text: string) => void;
}

const QUICK_ACTIONS = [
  {
    icon: FileSpreadsheet,
    label: "Auditar presupuesto",
    prompt: "Quiero auditar un presupuesto de obra. Voy a subir el archivo Excel.",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50",
    border: "border-green-200 dark:border-green-800",
  },
  {
    icon: Map,
    label: "Analizar plano",
    prompt: "Quiero analizar un plano DXF para extraer el cómputo métrico.",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    icon: BarChart3,
    label: "Comparar rubros",
    prompt: "Quiero comparar la incidencia de rubros de este presupuesto.",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50",
    border: "border-purple-200 dark:border-purple-800",
  },
  {
    icon: Clock,
    label: "Ver historial",
    prompt: "Mostrame un resumen del historial de auditorías que hicimos.",
    color: "text-orange-600",
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
  const greeting = userName
    ? `Hola ${userName.split(" ")[0]}, ¿qué querés hacer hoy?`
    : "¿Qué querés auditar hoy?";

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-6 px-8 text-center">
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
        className="space-y-1.5"
      >
        <h2 className="text-xl font-semibold tracking-tight">{greeting}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Soy {agentName} — auditá presupuestos, planos y documentos de obra con IA.
        </p>
      </motion.div>

      {/* Quick action chips */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-wrap justify-center gap-2"
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              variants={item}
              onClick={() => onQuickAction(action.prompt)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${action.bg} ${action.border}`}
            >
              <Icon className={`h-3.5 w-3.5 ${action.color}`} />
              <span className="text-foreground">{action.label}</span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* File type hints */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-[11px] text-muted-foreground/70"
      >
        Arrastrá Excel · PDF · DXF · DOCX · Imagen
      </motion.p>
    </div>
  );
}
