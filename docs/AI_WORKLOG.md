# AI Worklog - EdificIA

Registro corto para alternar entre Codex, Claude Code y otros agentes sin releer toda la historia del proyecto.

Reglas:

- Mantener entradas breves y accionables.
- Registrar solo cambios relevantes o handoffs con estado incompleto.
- No duplicar el roadmap ni el mapa de arquitectura.
- Incluir verificación ejecutada o explicar por qué no se ejecutó.
- Cuando una entrada queda totalmente completada y reflejada en `ROADMAP.md` y `docs/04_architecture_map.md`, podarla de acá.

Dónde vive cada cosa:

- **Pendientes y prioridades vigentes** → `ROADMAP.md`.
- **Migraciones, rutas, tablas, scope, expedientes, contexto empresarial, alerting, proactividad, hitos por fecha** → `docs/04_architecture_map.md` (incluye sección "Cambios destacados" con timeline).
- **Modelo Empresa → Obra → Expediente → Evidencia y plan Agent Core** → `docs/08_agent_core_redesign.md`.
- **Capa de Contexto Empresarial (visión y conectores)** → `docs/06_enterprise_context_layer.md`.
- **Lectura agéntica de documentos** → `docs/07_agentic_document_reading.md`.
- **Explicación holística para humanos** → `docs/EXPLICACION_PROYECTO_PARA_VOS.md`.
- **Historia detallada de cambios** → `git log` + commits enlazados desde el ROADMAP.

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

## 2026-05-19 - Codex - Contexto y documentos convergidos

- Objetivo: unificar Inteligencia Empresarial y Base Documental en un solo bloque de producto.
- Cambios: sidebar deja de mostrar Base Documental como sección separada; `EnterpriseSourcesPanel` vive como pestaña `Fuentes` dentro de Inteligencia Empresarial (`/dashboard/contexto/fuentes`); `/dashboard/documents` y `/dashboard/contexto/documentos` quedan como redirects legacy; docs actualizadas para explicitar que Base Documental es ingreso/preparación de fuentes dentro de la capa de inteligencia, no producto paralelo. `Expedientes` queda nombrado como `Mesa de Expedientes`: lugar operativo de trabajo, mientras el Radar solo muestra expedientes vinculados como evidencia.
- Archivos: `src/app/dashboard/layout.tsx`, `src/app/dashboard/contexto/layout.tsx`, `src/app/dashboard/contexto/fuentes/page.tsx`, `src/app/dashboard/contexto/documentos/page.tsx`, `src/app/dashboard/documents/page.tsx`, `src/components/enterprise-context/EnterpriseSourcesPanel.tsx`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/06_enterprise_context_layer.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm run build` OK. Browser in-app no disponible porque el Node REPL requerido por el plugin no está expuesto; verificación HTTP sin sesión confirma protección de rutas por login.
- Pendiente: QA visual autenticado manual para confirmar la pestaña Fuentes con datos reales y probar una carga de lote.

## 2026-05-19 - Codex - Memoria activa escribible + deploy

- Objetivo: agregar tool `recordar_aprendizaje` y desplegar la app con InsForge Deployments.
- Cambios: migración `20260519170241_active-agent-memory.sql` expande `company_learned_patterns.document_type` para `audit_history`/`agent_memory`; `src/lib/ai/active-memory.ts` upsertea aprendizajes confirmados con evidencia y audit log `agent.memory_recorded`; `agent-tools`/`agent-tools-bound` exponen la tool con scope server-side; prompt exige confirmación explícita. Cierre adicional: `verifyUserId()` queda strict por defecto en producción y `AUTH_STRICT_MODE=false` se documenta como break-glass.
- Archivos: `src/lib/ai/active-memory.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/lib/agent-core/runtime.ts`, `src/lib/auth/jwt.ts`, `src/components/enterprise-context/EnterpriseSourcesPanel.tsx`, `src/app/dashboard/contexto/fuentes/page.tsx`, `src/app/dashboard/contexto/documentos/page.tsx`, `src/app/dashboard/documents/page.tsx`, `src/app/dashboard/contexto/layout.tsx`, `src/app/dashboard/layout.tsx`, `migrations/20260519170241_active-agent-memory.sql`, `tests/agent/active-memory.test.mjs`, `tests/auth/jwt.test.mjs`, `.env.local.example`, `README.md`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/06_enterprise_context_layer.md`.
- Verificacion: `npm run migrate` OK; constraint remoto verificado; `npm test` OK (81/81); `npm run type-check` OK; `npm run lint` OK; `npm run build` OK.
- Pendiente: deploy InsForge bloqueado por plataforma. `deployments env list` falla con `Failed to fetch Vercel credentials: Internal Server Error`; `deployments deploy . --json` creó deployment `cdd6bb6c-22a2-4a14-9c42-1a899ac77f9e` pero falló con `Failed to upload deployment file` y quedó sin URL/provider id. Diagnóstico InsForge: `GET https://api.insforge.dev/sites/v1/credentials/daw63k5s` devuelve 500 para proyecto `daw63k5s` (`us-east`).

## Handoff vigente (2026-05-19) — ready-to-test

Estado al cierre del bloque actual (Claude):

- **Slice 2 de Contexto Empresarial completo**, incluyendo integración al agente: perfil empresarial vivo + `loadEnterpriseProfileForAgent()` cableado en `runtime.ts` + sección "Perfil de empresa" en `buildSystemPrompt()` + tool bound `consultar_perfil_empresa({ facet? })`. Ver "Pipeline del perfil" en `docs/04_architecture_map.md`, Etapa 3 en `docs/06_enterprise_context_layer.md` y §2.2 en `ROADMAP.md`.
- **`displayName` resuelto sin tabla nueva**. InsForge guarda el nombre en `auth.users.profile.name` (jsonb). `/api/auth/me` ahora llama a `client.auth.getProfile(userId)` cuando el JWT no trae nombre.
- **Lint global limpio**: los 3 errores preexistentes `react-hooks/set-state-in-effect` fueron corregidos (event-driven en `TopBarActions`, inner component en `ResetConfirmModal`, `useSyncExternalStore` en `useTheme`).
- Worklog histórico podado: las entradas previas están en ROADMAP + architecture map + `git log`.

### Listo para que vos lo testees

1. Logueate y entrá a `/dashboard/contexto/perfil` para ver el perfil. Tocá "Recalcular perfil" — la primera vez genera v1 desde los datos actuales.
2. Después, en el chat con una obra activa, el agente debería conocer entidades, moneda dominante y obras de riesgo del perfil. Probá preguntas como "qué proveedores usamos más en estructura" o "qué obras tienen riesgo crítico" — debería responder con el perfil sin inventar.
3. Si te falta evidencia, el agente puede llamar `consultar_perfil_empresa({ facet: "suppliers" })` para drill-down.
4. `Inteligencia Empresarial` ahora concentra `Radar`, `Fuentes` y `Mapa Vivo`; `/dashboard/documents` redirige a `/dashboard/contexto/fuentes`.

### Pendientes diferidos (no bloquean testing)

1. **Schedule InsForge de proactividad** _(en pausa)._ Requiere URL pública final y `CRON_SECRET`; no se registra automáticamente hasta que el usuario lo pida.
2. **Tests de integración contra DB real** _(decidido como overkill)._ El builder tiene tests puros del aggregator (`profile-aggregator.test.mjs`, 6 casos) y del prompt rendering (`prompt-integration.test.mjs`, 5 casos). Tests full con DB requieren staging org y la combinación type-check + lint + build cubre el resto de regresiones del builder.
3. **Conectores reales (Etapa 2 doc 06)**: Google Drive/SharePoint/SQL/exports. Es L y abre un frente nuevo de OAuth + secret management. Diferido a una próxima fase tras el testing del slice actual.
4. **QA visual autenticado** _(depende de vos)._ Las vistas relevantes son `/dashboard/contexto/perfil`, `/dashboard/contexto`, replay de auditoría en expediente, modal "Por qué", `/dashboard/admin/errors`.

### Auditoría completa al cierre (2026-05-19)

- `npm run type-check` OK.
- `npm run lint` OK (0 errores, 0 warnings).
- `npm test` OK (**81/81**).
- `npm run build` OK. Rutas Next nuevas/cambiadas cableadas: `/api/auth/me` (con profile fallback), `/api/enterprise-context/profile`, `/api/enterprise-context/profile/refresh`, `/dashboard/contexto/perfil`.
- InsForge: migraciones aplicadas, incluyendo `20260519170241_active-agent-memory.sql`. Schedule público y deploy siguen bloqueados/pausados por URL/plataforma.
- Dead code: borrado `src/components/ui/textarea.tsx` en la auditoría previa. Sin nuevos huérfanos.
- Docs sincronizadas: `ROADMAP.md` §2.2 ✅ ambas líneas (slice 2 + integración al agente), `docs/04_architecture_map.md` sección "Perfil Empresarial Vivo" actualizada + 2 entradas nuevas en timeline (`Perfil empresarial integrado al agente` y `display_name via InsForge profile`), `docs/06_enterprise_context_layer.md` Etapa 3 marcada parcial item por item, este `AI_WORKLOG.md` cierra el handoff.

---

## Antes de empezar una sesión nueva

1. Leer `ROADMAP.md` para confirmar prioridades.
2. Revisar esta sección "Handoff vigente" y los pendientes activos.
3. Si una decisión arquitectónica cambió, actualizar `docs/04_architecture_map.md` y reflejarlo acá solo si afecta al próximo handoff.
4. Al cerrar el bloque: si el item quedó completado y documentado en ROADMAP + architecture map, no agregar entrada nueva acá. Si quedó algo abierto, sumar entrada breve siguiendo el formato de arriba.
