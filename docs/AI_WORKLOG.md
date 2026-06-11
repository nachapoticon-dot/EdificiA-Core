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
