# Estado Actual del Proyecto — EdificIA

> **Última actualización**: 2026-05-14
>
> Este documento reemplaza el roadmap de sprints original (Sprints 1-4) que ya fueron completados en su totalidad.

## Sprints completados ✅

| Sprint | Entregable | Estado |
|--------|-----------|--------|
| Sprint 1 | Auth + DB + InsForge conectado | ✅ Completado |
| Sprint 2 | Chat UI + Motor de auditoría + Vercel AI SDK | ✅ Completado |
| Sprint 3 | Upload de archivos + Procesadores (PDF, Excel, DXF, DOCX, Imagen) | ✅ Completado |
| Sprint 4 | Dark/Light mode, historial de sesiones, visor DXF WebGL | ✅ Completado |
| Profesionalización | Logger, rate limiter, error helpers, Super Admin, security fixes | ✅ Completado |

## Fase actual: Preparación para producción

El proyecto está en la fase de **hardening pre-deploy**. Las features core están construidas y funcionando. Lo que falta es:

1. **Migrar autenticación a server-side** → `docs/planning/PLAN_LOGIN_FRONTEND_BACKEND.md`
2. **Corregir bugs de seguridad y roles** → `docs/planning/TAREAS_CLAUDE.md` (sección Bugs Activos)
3. **UX y responsive** → `docs/planning/PLAN_DE_MEJORA.md` (sección 9)
4. **Completar flujo de onboarding** → `docs/planning/PLAN_FLUJO_EMPRESAS.md`

## Lo que está estable y no se toca

- Sistema de RAG (búsqueda híbrida semántica + FTS)
- Procesadores de archivos (PDF, Excel, DXF, DOCX, imagen)
- UI Generativa (4 bloques: métricas, comparativa, cronograma, legajo gráfico)
- System prompt del agente (198 líneas calibradas)
- Tools del agente (38KB, 10+ herramientas)
- Migraciones de DB (14 archivos, no modificar)
