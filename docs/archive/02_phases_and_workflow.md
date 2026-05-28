# Estado Actual del Proyecto — EdificIA

> ⚠️ **DOCUMENTO HISTÓRICO / ARCHIVADO.** Snapshot de sprints de la etapa "hardening pre-deploy" (2026-05-14). El estado y los pendientes vigentes viven en `ROADMAP.md`; el timeline técnico, en `docs/04_architecture_map.md`. No usar como referencia de estado actual.
>
> Este documento reemplazó al roadmap de sprints original (Sprints 1-4).

## Sprints completados ✅

| Sprint | Entregable | Estado |
|--------|-----------|--------|
| Sprint 1 | Auth + DB + InsForge conectado | ✅ Completado |
| Sprint 2 | Chat UI + Motor de auditoría + Vercel AI SDK | ✅ Completado |
| Sprint 3 | Upload de archivos + Procesadores (PDF, Excel, DXF, DOCX, Imagen) | ✅ Completado |
| Sprint 4 | Dark/Light mode, historial de sesiones, visor DXF WebGL | ✅ Completado |
| Profesionalización | Logger, rate limiter, error helpers, Super Admin, security fixes | ✅ Completado |

## Fase actual: Preparación para producción

El proyecto está en la fase de **hardening pre-deploy**. Las features core están construidas y funcionando.
El listado actualizado de pendientes (técnicos + estratégicos) vive en [`ROADMAP.md`](../ROADMAP.md) en la raíz del repo.

## Lo que está estable y no se toca

- Sistema de RAG (búsqueda híbrida semántica + FTS)
- Procesadores de archivos (PDF, Excel, DXF, DOCX, imagen)
- UI Generativa (4 bloques: métricas, comparativa, cronograma, legajo gráfico)
- System prompt del agente (198 líneas calibradas)
- Tools del agente (38KB, 10+ herramientas)
- Migraciones de DB (14 archivos, no modificar)
