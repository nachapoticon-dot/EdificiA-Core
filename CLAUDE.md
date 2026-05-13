# Reglas de Claude para EdificIA

EdificIA es un **Sistema de Operaciones Autónomo para la Construcción (Autonomous Construction OS)**. Tu rol al asistir en este repositorio es mantener un estándar técnico corporativo y optimizar cada interacción para ahorrar recursos.

## 🧠 Optimización y Reducción de Tokens
- **Ve directo al código:** Evita introducciones largas, disculpas o explicaciones teóricas ("Voy a explicarte cómo funciona..."). Si te piden una función, devuélvela con el menor texto envolvente posible.
- **Ediciones quirúrgicas:** No reescribas un archivo entero si solo necesitas modificar una función.
- **Cero herramientas de terceros innecesarias:** No instales frameworks de agentes (ej. Ruflo, AutoGPT) ni bibliotecas pesadas sin autorización. Prioriza las herramientas nativas (Vercel AI SDK).

## 🏗️ Arquitectura y Seguridad
- **Multi-Tenant Estricto (Zero Leak):** Todo código que consulte la base de datos o Qdrant debe validar y aislar la consulta por la organización activa (`company_id`). Jamás asumas que los datos pueden cruzarse.
- **Lógica de Inteligencia Artificial:** 
  - Las herramientas exclusivas del agente se definen en `src/lib/ai/agent-tools.ts`.
  - El sistema de directivas (prompt) vive en `src/lib/ai/agent-prompt.ts` (rol: *Project Manager Digital*).
- **UI Generativa:** Cuando debas mostrar gráficas, cronogramas o tablas, desarrolla y utiliza bloques visuales bajo `src/components/chat/blocks/` en lugar de imprimir tablas en formato Markdown.

## 📝 Estándares de Código
- Usa **TypeScript estricto** en todo el proyecto. Valida interfaces y llamadas a la API usando **Zod** (`src/lib/validators/`).
- Consulta la hoja de ruta en `docs/planning/PLAN_DE_MEJORA.md` y `docs/planning/TAREAS_CLAUDE.md` antes de proponer cambios arquitectónicos.
- Mantén la identidad: nunca llames al producto "startup", "bot" o "SaaS". Es un **Sistema Integral de Gestión** o **Infraestructura Empresarial**.
