import type { AgentCapability } from "./types";

export const AGENT_CAPABILITIES: readonly AgentCapability[] = [
  {
    id: "context.search",
    label: "Contexto empresarial",
    description: "Busca evidencia en RAG, grafo documental, memoria empresarial y fuentes conectadas.",
    requiresProject: false,
    writesData: false,
  },
  {
    id: "document.audit",
    label: "Auditoría documental",
    description: "Clasifica documentos, extrae señales, contrasta evidencia y produce veredictos.",
    requiresProject: false,
    writesData: false,
  },
  {
    id: "budget.audit",
    label: "Auditoría de presupuesto",
    description: "Calcula totales, cierres, incidencias, comparativas e índices de precios.",
    requiresProject: false,
    writesData: false,
  },
  {
    id: "project.brief",
    label: "Brief de obra",
    description: "Consolida cronograma, HSE, acopios, finanzas, alertas y clima.",
    requiresProject: true,
    writesData: false,
  },
  {
    id: "operations.update",
    label: "Acciones operativas",
    description: "Registra o actualiza HSE, acopios, subcontratos, cronograma y relaciones documentales.",
    requiresProject: true,
    writesData: true,
  },
  {
    id: "documents.generate",
    label: "Generación documental",
    description: "Prepara presupuestos, informes, memorias, órdenes de compra y partes diarios.",
    requiresProject: false,
    writesData: false,
  },
  {
    id: "communications.prepare",
    label: "Preparación de comunicación",
    description: "Redacta comunicaciones operativas con destinatarios, asunto y cuerpo propuestos.",
    requiresProject: true,
    writesData: false,
  },
  {
    id: "communications.send",
    label: "Envío de comunicación",
    description: "Envía comunicaciones confirmadas por el usuario y registra trazabilidad.",
    requiresProject: true,
    writesData: true,
  },
];

export function getCapabilitiesForScope(hasProject: boolean): readonly AgentCapability[] {
  return AGENT_CAPABILITIES.filter((capability) => hasProject || !capability.requiresProject);
}
