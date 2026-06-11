# AI Worklog - EdificIA

Registro corto para alternar entre Codex, Claude Code y otros agentes sin releer toda la historia del proyecto.

Reglas:

- Mantener entradas breves y accionables.
- Registrar solo cambios relevantes o handoffs con estado incompleto.
- No duplicar el roadmap ni el mapa de arquitectura.
- Incluir verificación ejecutada o explicar por qué no se ejecutó.
- Este archivo es **solo el handoff reciente**, no la historia completa. Cuando una entrada queda totalmente completada y reflejada en `docs/00_PRODUCTO.md` y `docs/04_architecture_map.md`, podarla de acá.

Dónde vive cada cosa:

- **Visión, estado y pendientes vigentes** → `docs/00_PRODUCTO.md`.
- **Migraciones, rutas, tablas, scope, expedientes, contexto empresarial, alerting, proactividad, hitos por fecha** → `docs/04_architecture_map.md` (sección "Registro de Cambios Estructurales").
- **Modelo Empresa → Obra → Expediente → Evidencia y plan Agent Core** → `docs/08_agent_core_redesign.md`.
- **Capa de Contexto Empresarial (visión y conectores)** → `docs/06_enterprise_context_layer.md`.
- **Lectura agéntica de documentos** → `docs/07_agentic_document_reading.md`.
- **Explicación holística para humanos** → `docs/EXPLICACION_PROYECTO_PARA_VOS.md`.
- **Historia detallada de cambios** → `git log`.

Formato:

```md
## YYYY-MM-DD - Agente - Tarea corta

- Objetivo: ...
- Cambios: ...
- Archivos: `ruta/a.ts`, `ruta/b.tsx`
- Verificacion: `npm run type-check` OK / no ejecutado porque ...
- Pendiente: ...
```

---

## 2026-06-11 - Claude Code - Limpieza de reglas: AGENTS.md eliminado, CLAUDE.md única guía

- Objetivo: corregir reglas desactualizadas/contradictorias detectadas en auditoría de guías operativas.
- Cambios: `AGENTS.md` eliminado — `CLAUDE.md` es la única guía operativa canónica (cualquier agente debe leerla; se acabó el espejado manual que generaba drift). En `CLAUDE.md`: conteo de bloques corregido (4→6), regla shadcn simplificada (sin mantenimiento de manifest; `docs/design/shadcn-blocks/` queda como histórico), referencias a herramientas inexistentes (`StartLine`/`EndLine`, multi-edit) reemplazadas, regla de búsquedas con excepción para renames, lectura de `00_PRODUCTO.md` acotada a tareas de producto, y regla de multi-tenancy reforzada (no confiar en IDs del cliente — preservada de AGENTS.md). Además: puntero roto a `ROADMAP.md` corregido en `docs/05_future_roadmap.md` y file-nesting de `.vscode/settings.json` actualizado.
- Archivos: `CLAUDE.md`, `AGENTS.md` (borrado), `docs/05_future_roadmap.md`, `.vscode/settings.json`
- Verificacion: solo docs/config; no aplica type-check.
- Pendiente: si se retoma Codex u otro agente, apuntarlo a `CLAUDE.md` (no recrear AGENTS.md).

---

## 2026-06-11 - Claude Code - Agente especializado PM Digital (plan 10 ejecutado completo)

- Objetivo: ejecutar las 4 etapas de `docs/10_plan_agente_especializado.md` — quitar el sesgo "siempre auditoría" y redocumentar.
- Cambios: ROADMAP.md eliminado → `docs/00_PRODUCTO.md` único doc vivo; architecture map y EXPLICACION actualizados al stack real; prompt modular por capacidades (`src/lib/ai/turn-modes.ts` + `agent-prompt.ts` reescrito: CORE+OPERATIONS siempre, DOCUMENTS/GENERATION/COMMUNICATIONS por señal) con tools filtradas por modo en ambos backends; apertura operativa (resumen_diario_obra ante saludo con obra activa); quick-prompts operativos; Python: señales operativas vivas (findings + vencimientos HSE) inyectadas al turno y reflexión al cierre de expediente; evals de conducta en `evals/` (npm run eval:agent).
- Verificación: evals 13/13 (TS) + 3/3 (Python, incl. respuesta desde memoria sin tools); tokens del turno "Hola": ~10k totales en 2 pasos vs 23k por paso antes; npm test 104/104; type-check OK; build OK.
- Pendiente: ver `docs/00_PRODUCTO.md`. Nota: los evals viven en `evals/` raíz (no services/agent/evals como decía el plan) porque ejercitan ambos backends vía /api/chat.

---

## 2026-06-11 - Claude Code - Desconexión InsForge/Qdrant + agente Python

- Objetivo: eliminar dependencia de InsForge y Qdrant; preparar agente real (cerebro Python con aprendizaje genuino) portable a otra infraestructura.
- Cambios: 7 fases (historia en git, un commit por fase en `feat/desconexion-insforge-qdrant`). Resumen: capa de datos propia `src/lib/db/` (query-builder compatible sobre `pg`), auth local (`src/lib/auth/local-*`), storage filesystem, pgvector en `document_chunks`, runner de migraciones propio, servicio `services/agent/` (FastAPI) detrás de `AGENT_BACKEND=python` con tool gateway `/api/internal/*`, y loop de aprendizaje real (`agent_memories`/`agent_feedback`, reflexión LLM, retrieval semántico, decay).
- Contexto clave: el proyecto InsForge cloud estaba caído (HTTP 503) — no había datos que migrar; cutover con base limpia. Colima+Docker instalados en esta máquina para correr Postgres local.
- Verificación: `npm test` 98/98 · `npm run type-check` OK · `npm run build` OK · `npm run smoke:chat` OK · E2E manual: register/login/refresh/me, upload→reindex→búsqueda pgvector, chat streameado por ambos backends (TS y Python) con tool round-trip por gateway, reflexión → memoria → retrieval en conversación nueva, feedback → memoria de corrección.
- Pendiente: ver `docs/00_PRODUCTO.md` (architecture map ya actualizado 2026-06-11).
- Operación local: `docker compose up -d postgres` → `npm run migrate` → `npm run dev` + `cd services/agent && .venv/bin/uvicorn app.main:app --port 8000` (secrets en `.env.local` y `services/agent/.env`).

---

## Antes de empezar una sesión nueva

1. Leer `docs/00_PRODUCTO.md` para confirmar visión, estado y prioridades.
2. Revisar el handoff más reciente de arriba.
3. Si una decisión arquitectónica cambió, actualizar `docs/04_architecture_map.md` y reflejarlo acá solo si afecta al próximo handoff.
4. Al cerrar el bloque: si el item quedó completado y documentado en 00_PRODUCTO + architecture map, no agregar entrada nueva acá. Si quedó algo abierto, sumar entrada breve siguiendo el formato de arriba.
