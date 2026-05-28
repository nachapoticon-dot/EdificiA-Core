# Documentación de EdificIA

> Índice documental canónico. Cada tema tiene **un** documento de referencia: si el contenido vive en otro lado, este índice apunta ahí en vez de duplicarlo.

## Documentos canónicos

| Archivo | Contenido | Cuándo leerlo |
|---------|-----------|---------------|
| [../README.md](../README.md) | Qué es EdificIA, stack real y cómo levantarlo en local | Para entrar al proyecto |
| [../ROADMAP.md](../ROADMAP.md) | Pendientes y prioridades **vigentes** + pendientes externos | Siempre al inicio de una sesión |
| [03_domain_knowledge.md](./03_domain_knowledge.md) | Lógica del motor de auditoría dinámico de obra | Antes de tocar auditoría, presupuestos o dominio |
| [04_architecture_map.md](./04_architecture_map.md) | Arquitectura real, tablas, rutas y timeline técnico | **Obligatorio** antes de modificar estructura |
| [06_enterprise_context_layer.md](./06_enterprise_context_layer.md) | Contexto / Inteligencia Empresarial: fuentes, RAG, indexación, conectores | Antes de tocar fuentes, RAG empresarial o auditoría transversal |
| [07_agentic_document_reading.md](./07_agentic_document_reading.md) | Lectura agéntica de documentos y UX de auditoría | Antes de tocar prompt, tools de documentos o bloques visuales |
| [08_agent_core_redesign.md](./08_agent_core_redesign.md) | Modelo Empresa → Obra → Expediente → Evidencia | Antes de tocar chat, sesiones, expedientes o scope del agente |
| [AI_WORKLOG.md](./AI_WORKLOG.md) | Handoff reciente entre agentes IA (no historia infinita) | Al alternar entre Codex, Claude Code u otro agente |
| [EXPLICACION_PROYECTO_PARA_VOS.md](./EXPLICACION_PROYECTO_PARA_VOS.md) | Explicación holística del proyecto para el equipo humano | Para armar un mapa mental completo, sin tecnicismos |

## Visión a futuro (no comprometida)

| Archivo | Contenido |
|---------|-----------|
| [05_future_roadmap.md](./05_future_roadmap.md) | Ideas de largo plazo (DWG nativo, OCR, BIM/IFC, cómputo automático). **No son pendientes vigentes** — el estado real de pendientes vive en `ROADMAP.md`. |

## Archivo histórico

No usar como referencia operativa. Se conservan solo para arqueología.

- [archive/01_vision_and_stack.md](./archive/01_vision_and_stack.md) — visión y stack fundacionales (etapa "Gemini para la Construcción").
- [archive/02_phases_and_workflow.md](./archive/02_phases_and_workflow.md) — snapshot de sprints (hardening pre-deploy, 2026-05-14).
- [archive/db-migrations-legacy/](./archive/db-migrations-legacy/) — migraciones raw SQL previas a la ruta canónica `migrations/`.

## Bandeja de bloques Shadcn

- [design/shadcn-blocks/](./design/shadcn-blocks/) — `raw/` (referencia tal cual), `adapted/` (staging revisado), `manifest.json` (índice). Nada se importa directo desde `raw/`.
