# AI Worklog - EdificIA

Registro corto para alternar entre Codex, Claude Code y otros agentes sin releer toda la historia del proyecto.

Reglas:

- Mantener entradas breves y accionables.
- Registrar solo cambios relevantes o handoffs con estado incompleto.
- No duplicar el roadmap. Los pendientes estratégicos viven en `ROADMAP.md`.
- Incluir verificación ejecutada o explicar por qué no se ejecutó.

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

## 2026-05-18 - Codex - Vista global de expedientes

- Objetivo: exponer una vista operativa central de expedientes de toda la organización, agrupable por estado o veredicto.
- Cambios:
  - Nueva ruta `/dashboard/expedientes` con métricas de activos/observados/terminales, búsqueda, filtro de estado y agrupación por `status` o `verdict`.
  - Navegación lateral suma "Expedientes".
  - `useWorkCases()` acepta `limit` para que la vista global consulte más filas sin cambiar el uso por obra.
  - La vista permite abrir detalle cuando el expediente tiene `projectId` y abrir chat cuando tiene sesión asociada.
  - Roadmap y arquitectura actualizados.
- Archivos: `src/app/dashboard/expedientes/page.tsx`, `src/app/dashboard/layout.tsx`, `src/hooks/useWorkCases.ts`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/register-ts-loader.mjs --test tests/**/*.test.mjs` OK (58/58); `npm run lint` OK; `npm run build` OK.
- Pendiente: detalle global para expedientes sin `projectId` si se quieren operar expedientes empresariales no asociados a obra.

## 2026-05-18 - Codex - Cierre agéntico de expediente

- Objetivo: permitir que el agente proponga el cierre de un expediente operativo con veredicto, resumen y evidencia citable cuando ya completó la auditoría.
- Cambios:
  - Nueva tool `proponer_cierre_expediente` en el catálogo y versión bound en `createBoundTools()`. La versión expuesta al modelo no acepta `organizationId` ni `actorUserId`; ambos se inyectan server-side.
  - `buildSystemPrompt()` recibe `workCaseId` desde el runtime validado y agrega reglas estrictas para usar la tool solo con evidencia suficiente y nunca sobre expedientes ya terminales.
  - `closeWorkCaseFromAgent()` actualiza el expediente a `resolved`, escribe `verdict`, `summary`, `closed_at`, `closed_by_user_id`, registra `work_case.status_changed` y agrega evidencia opcional en `work_case_evidence`.
  - Documentado el cierre agéntico en arquitectura, roadmap y rediseño Agent Core.
- Archivos: `src/lib/agent-core/work-case-closer.ts`, `src/lib/agent-core/index.ts`, `src/lib/agent-core/types.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `node --env-file=.env.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/register-ts-loader.mjs --test tests/**/*.test.mjs` OK (58/58); `npm run lint` OK; `npm run build` OK. `npm test` sin cargar `.env.local` falla en este entorno por `Missing NEXT_PUBLIC_INSFORGE_URL`.
- Pendiente: no hay migración nueva. Siguiente línea sugerida: vista global/agrupada de expedientes por estado y veredicto, o Contexto Empresarial.

## 2026-05-18 - Claude - Cierre de expediente con veredicto + reportes documentales en UI

- Objetivo: cerrar el plan de migración Agent Core exponiendo lectura completa de `document_intelligence_reports` en el expediente y habilitando cierre con `verdict` + `summary` editables antes del estado terminal.
- Cambios:
  - Migración `20260518190721_work-case-verdict-closure.sql`: agrega `work_cases.verdict` (CHECK ∈ {`approved`,`flagged`,`inconclusive`,`rejected`,`superseded`}) y `work_cases.closed_by_user_id`; índice parcial por `organization_id, verdict`.
  - `GET /api/work-cases/[id]`: ahora consulta `document_intelligence_reports` por `work_case_id`, resuelve `fileName` desde `uploaded_files` (filtrado por org) y devuelve `documentReports[]` con clasificación, extracción, riesgos, hallazgos, veredicto, confianza y metadata. Devuelve también `verdict`, `closedByUserId` y `closedAt` del expediente.
  - `PATCH /api/work-cases/[id]`: acepta `verdict` (validado contra el CHECK) y `summary`; al pasar a estado terminal escribe `closed_at` y `closed_by_user_id = auth.userId`; al reabrir limpia ambos y resetea `verdict` cuando no se envía explícitamente. El evento `work_case.status_changed` agrega `previousVerdict`, `verdict`, `summary` y `closedByUserId` al payload.
  - `WorkCaseVerdict` exportado desde `src/lib/agent-core/types.ts` y `src/lib/agent-core/index.ts`; schemas `workCaseVerdictSchema`, `documentReportEntrySchema` y campos nuevos del expediente añadidos en `src/lib/validators/api-responses.ts`.
  - `src/hooks/useWorkCases.ts`: `updateWorkCaseStatus()` ahora acepta `{ status, summary?, verdict? }` además del string legacy.
  - `/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`: nueva sección "Reportes documentales" con badges de veredicto/tipo, riesgos y hallazgos expandibles más detalle de clasificación/extracción/metadata; bloque "Resolución del expediente" muestra `verdict`+`summary` cuando existen; las acciones `Resolver`/`Cerrar` ahora abren un modal con selector de veredicto y textarea de resumen (límite 2000). `Reabrir` limpia veredicto y summary.
- Archivos: `migrations/20260518190721_work-case-verdict-closure.sql`, `src/app/api/work-cases/route.ts`, `src/app/api/work-cases/[id]/route.ts`, `src/lib/agent-core/types.ts`, `src/lib/agent-core/index.ts`, `src/lib/validators/api-responses.ts`, `src/hooks/useWorkCases.ts`, `src/app/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run lint` OK; `npm run build` OK; `npm run migrate` aplicó `20260518190721_work-case-verdict-closure.sql`.
- Pendiente: plan de migración Agent Core cerrado. Próxima línea sugerida: tool agéntica que proponga `verdict`/`summary` con evidencia citable, o vista global de expedientes agrupados por estado/veredicto.

---

## 2026-05-18 - Codex - Document intelligence reports

- Objetivo: persistir clasificación, extracción, riesgos y veredictos documentales por archivo, vinculables a expedientes/evidencia.
- Cambios:
  - Migración `20260518104406_document-intelligence-reports.sql`: crea `document_intelligence_reports` con RLS por `organization_id`, vínculos a archivo/obra/expediente/agent_run, `classification`, `extraction`, `risks`, `findings`, `verdict`, `confidence` y `summary`.
  - `work_case_evidence` suma `evidence_type='document_report'`.
  - `/api/upload` escribe reportes `upload_scan` best-effort usando el procesamiento existente, PII scan y context scan; acepta `x-chat-session-id` para vincular expediente si ya existe.
  - `ensureWorkCaseForChatSession()` vincula el último reporte documental del archivo al expediente recién creado cuando el upload ocurrió antes de la sesión.
- Archivos: `migrations/20260518104406_document-intelligence-reports.sql`, `src/lib/document-intelligence/report-writer.ts`, `src/lib/document-intelligence/report-linker.ts`, `src/app/api/upload/route.ts`, `src/app/dashboard/chat/page.tsx`, `src/lib/agent-core/work-case-writer.ts`, `src/lib/validators/api-responses.ts`, `src/app/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run lint` OK; `npm run build` OK; `npm run migrate` aplicó `20260518104406_document-intelligence-reports.sql`.
- Pendiente: exponer lectura completa de reportes documentales en la UI/API de expediente y usar estos reportes para un cierre con veredicto editable.

## 2026-05-18 - Codex - Agent runs y acciones de expediente

- Objetivo: cerrar la trazabilidad granular por ejecución del agente y permitir resolver/cerrar/reabrir expedientes desde la vista operativa.
- Cambios:
  - Migración `20260518004152_agent-runs.sql`: crea `agent_runs` con RLS por `organization_id`, vínculos a obra/expediente/sesión, modelo, tier, capabilities, usage, telemetría de tools, latencia y request id.
  - `writeAgentRun()` registra ejecuciones best-effort; `/api/chat` lo invoca en `onFinish`, vincula `agentRunId` al audit log y al evento `work_case_events.chat.turn_completed`.
  - `PATCH /api/work-cases/[id]`: valida auth/rol/org, cambia `status`/`summary`, ajusta `closed_at` y registra `work_case_events.work_case.status_changed`.
  - La vista `/dashboard/obras/[id]/expedientes/[workCaseId]` suma acciones `Resolver`, `Cerrar` y `Reabrir`.
- Archivos: `migrations/20260518004152_agent-runs.sql`, `src/lib/agent-core/agent-run-writer.ts`, `src/app/api/chat/route.ts`, `src/app/api/work-cases/[id]/route.ts`, `src/hooks/useWorkCases.ts`, `src/app/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run lint` OK; `npm run build` OK; `npm run migrate` aplicó `20260518004152_agent-runs.sql`.
- Pendiente: siguiente bloque recomendado: `document_intelligence_reports` para persistir clasificación/extracción/veredictos documentales y vincularlos a expedientes/evidencia.

## 2026-05-18 - Codex - Vista de trazabilidad de expediente

- Objetivo: hacer visible la trazabilidad profunda de un expediente operativo desde la obra.
- Cambios:
  - `GET /api/work-cases/[id]`: devuelve expediente, eventos (`work_case_events`) y evidencias (`work_case_evidence`) filtrando por `organization_id = auth.orgId`; resuelve la sesión del usuario actual si existe.
  - `workCaseDetailResponseSchema` y tipos derivados en `src/lib/validators/api-responses.ts`.
  - `useWorkCaseDetails()` en `src/hooks/useWorkCases.ts`.
  - `/dashboard/obras/[id]`: cada expediente ahora tiene acción "Ver" además de "Abrir" chat.
  - Nueva vista `/dashboard/obras/[id]/expedientes/[workCaseId]`: métricas, replay de eventos con payload expandible, evidencia con metadata expandible y CTA a chat asociado.
- Archivos: `src/app/api/work-cases/[id]/route.ts`, `src/app/dashboard/obras/[id]/expedientes/[workCaseId]/page.tsx`, `src/app/dashboard/obras/[id]/page.tsx`, `src/hooks/useWorkCases.ts`, `src/lib/validators/api-responses.ts`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run lint` OK; `npm run build` OK.
- Pendiente: `agent_runs` para trazabilidad granular por ejecución y acciones explícitas de resolución/cierre de expediente.

---

## 2026-05-18 - Codex - Cierre plan migración Agent Core

- Objetivo: completar pendientes del plan de migración Agent Core: UI inicial de expediente, legacy migration y modularización runtime sin cambiar prompt efectivo ni catálogo de tools.
- Cambios:
  - `GET /api/work-cases`: lista expedientes por org/obra y devuelve la `chatSessionId` asociada al usuario actual cuando existe.
  - `useWorkCases()` y `/dashboard/obras/[id]`: muestran expedientes operativos y permiten abrir el chat vinculado al expediente.
  - Migración `20260518002617_legacy-work-cases.sql`: crea `work_cases.kind='legacy_conversation'` para `chat_sessions` históricas con `project_id`, actualiza `chat_sessions.work_case_id`, registra evento `chat_session.legacy_linked` y evidencia de snapshot/archivos inferidos.
  - `src/lib/agent-core/runtime.ts`: concentra resolución de scope, obra/sesión validada, prompt efectivo, tools bound, recent sessions, patrones aprendidos y `capabilityIds`. `/api/chat` queda como orquestador de stream, telemetría y audit writes.
- Archivos: `migrations/20260518002617_legacy-work-cases.sql`, `src/app/api/work-cases/route.ts`, `src/hooks/useWorkCases.ts`, `src/app/dashboard/obras/[id]/page.tsx`, `src/lib/agent-core/runtime.ts`, `src/lib/agent-core/index.ts`, `src/app/api/chat/route.ts`, `src/lib/validators/api-responses.ts`, `docs/04_architecture_map.md`, `docs/08_agent_core_redesign.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run lint` OK; `npm run build` OK; `npm run migrate` aplicó `20260518002617_legacy-work-cases.sql`. Dev server activo en `http://localhost:3000`.
- Pendiente: trazabilidad visual profunda de expediente (`work_case_events`/`work_case_evidence`), replay de auditoría y explicación expandible de hallazgos. El plan de migración Agent Core de esta etapa queda cerrado.

---

## 2026-05-18 - Codex - Operational findings read model

- Objetivo: separar hallazgos vivos de `audit_log_events` para que proactividad y daily brief lean estado accionable desde una tabla propia.
- Cambios:
  - Migración `20260518001800_operational-findings.sql`: crea `operational_findings` con RLS por `organization_id`, `status` (`open/resolved/dismissed`), `finding_key` único por org/obra, severidad/tipo, vínculo a entidad, metadata y timestamps de detección/resolución.
  - `src/lib/proactivity/operational-findings.ts`: helper `replaceProjectOperationalFindings()` upsertea hallazgos actuales por obra y marca como `resolved` los `open` que ya no aparecen.
  - `runDailyProjectScan()` ahora actualiza `operational_findings` y deja en `audit_log_events` solo resumen append-only con conteos y `findingKeys`.
  - `GET /api/proactivity/findings` lee `operational_findings(status=open)` y mantiene el mismo contrato de respuesta para la UI.
  - `buildDailyBrief()` calcula alertas desde `operational_findings`, no desde `audit_log_events`.
- Archivos: `migrations/20260518001800_operational-findings.sql`, `src/lib/proactivity/operational-findings.ts`, `src/lib/proactivity/daily-scan.ts`, `src/app/api/proactivity/findings/route.ts`, `src/lib/project-operations/brief/daily-brief.ts`, `docs/04_architecture_map.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run migrate` aplicó `20260518001800_operational-findings.sql`; smoke `runDailyProjectScan({ limit: 1 })` OK (`scannedProjects=0`, sin hallazgos en el entorno actual).
- Pendiente: primer UI de expediente en obra: listar expedientes abiertos/recientes y permitir abrir chat dentro de un expediente sin eliminar compatibilidad de sesiones.

---

## 2026-05-17 - Codex - Wire audit-only workCaseId en chat

- Objetivo: que `/api/chat` persista `agentCore.scope.workCaseId` real y deje bitácora del turno cuando la sesión pertenece a un expediente, sin cambiar prompt, tools ni UX.
- Cambios:
  - `src/proxy.ts`: CORS permite `x-chat-session-id`.
  - `src/app/dashboard/chat/page.tsx`: `DefaultChatTransport` envía `x-chat-session-id` desde la sesión activa cuando existe.
  - `src/app/api/chat/route.ts`: lee el header, busca `chat_sessions(work_case_id, project_id)` filtrando por `organization_id`, `user_id`, `id` y `deleted_at IS NULL`; pasa `workCaseId` a `buildAgentCoreScope()` y usa `project_id` de la sesión si no venía `x-project-id`.
  - `onFinish` inserta best-effort `work_case_events.event_type = 'chat.turn_completed'` con telemetría de modelo, tier, step budget, steps, totales de tools y latencia. Fallas del insert se loguean sin romper el stream.
- Archivos: `src/proxy.ts`, `src/app/dashboard/chat/page.tsx`, `src/app/api/chat/route.ts`, `docs/04_architecture_map.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run migrate` no ejecutado porque no hay migración nueva.
- Pendiente: crear migración/read model `operational_findings` para que `runDailyProjectScan()` y `buildDailyBrief()` dejen de usar `audit_log_events` como tabla primaria de estado vivo.

---

## 2026-05-17 - Claude - Asociar chat_sessions a work_cases (backward-compatible)

- Objetivo: que cada sesión nueva iniciada desde una obra cree o reuse un expediente operativo, sin tocar legacy ni UX.
- Cambios:
  - Migración `20260517210757_chat-session-work-case-link.sql`: `chat_sessions.work_case_id UUID NULL` con FK a `work_cases(id) ON DELETE SET NULL` + dos índices parciales (`idx_chat_sessions_work_case`, `idx_chat_sessions_org_work_case`).
  - `src/lib/agent-core/types.ts`: `WorkCaseKind` y `WorkCaseStatus` alineados al CHECK de `migrations/20260517210141_work-cases.sql`. El test `agent-core scope` sigue verde porque usa `document_audit`.
  - `src/lib/agent-core/work-case-writer.ts` (nuevo): `ensureWorkCaseForChatSession()` crea un `work_case` con `kind` inferido del `fileType` (`excel → budget_audit`, `pdf/docx/dxf/image → document_audit`, default `general`), `status='open'`, `owner_user_id=auth.userId`, `metadata.chatSessionId`, y registra evento `chat_session.linked` en `work_case_events`. Tolera errores (devuelve `null` y loggea con `dbLogger.warn`).
  - `src/lib/agent-core/index.ts`: exporta el helper.
  - `src/app/api/sessions/route.ts` (POST): cuando hay `projectId` válido, busca primero `chat_sessions.work_case_id` existente (idempotencia ante re-upsert); si está vacío, llama al helper y persiste el resultado en la columna nueva.
- Archivos: `migrations/20260517210757_chat-session-work-case-link.sql`, `src/lib/agent-core/types.ts`, `src/lib/agent-core/work-case-writer.ts`, `src/lib/agent-core/index.ts`, `src/app/api/sessions/route.ts`, `docs/04_architecture_map.md`, `ROADMAP.md`.
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58); `npm run migrate` aplicó la migración contra InsForge.
- Pendiente: wire audit-only opcional en `/api/chat` (leer `x-chat-session-id`, hacer lookup de `chat_sessions.work_case_id` y persistir en `agentScope.workCaseId` del audit payload); siguiente bloque mayor: `operational_findings` para que proactividad y daily brief dejen de leer `audit_log_events` como read model.

---

## 2026-05-17 - Claude - Migración inicial de Expedientes Operativos

- Objetivo: introducir schema base del Agent Core (`Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias`) sin tocar UX ni prompt.
- Cambios: nueva migración con tres tablas + RLS por `organization_id`.
  - `work_cases` (kind/status/title/summary/owner_user_id/closed_at/metadata + soft-delete). `kind` y `status` con CHECK; `project_id` nullable; índices por org/created_at, org/project, org/status, org/kind.
  - `work_case_events` (bitácora append-only): `event_type TEXT` libre, `summary`, `payload JSONB`, FK a `work_cases` con `ON DELETE CASCADE`. Solo `admin` puede DELETE; sin policy de UPDATE.
  - `work_case_evidence`: `evidence_type` con CHECK sobre 13 tipos (`file`/`chunk`/`relation`/`audit_event`/`tool_run`/`finding`/`message`/`schedule_task`/`hse_record`/`supply_item`/`financial_snapshot`/`subcontract`/`external`); `entity_type`/`entity_id` flexibles; `confidence` opcional en `[0,1]`.
  - RLS estándar del repo: `get_my_org_ids()` para SELECT, `organization_members` con role `admin`/`engineer` para INSERT/UPDATE, solo `admin` para DELETE, rol interno `project_admin` con acceso total.
- Archivos: `migrations/20260517210141_work-cases.sql`, `docs/04_architecture_map.md`, `ROADMAP.md`.
- Verificacion: `npm run type-check` OK (sin código nuevo a tipar); `npm test` OK (58/58); `npm run migrate` aplicó `20260517210141_work-cases.sql` contra InsForge.
- Pendiente: asociar nuevas `chat_sessions` a `work_case_id` de forma backward-compatible; mantener flujo legacy intacto; siguiente bloque debería introducir `operational_findings` (no incluido acá por decisión explícita del prompt).

---

## 2026-05-16 - Codex - Reglas operativas compartidas

- Objetivo: crear una guía nativa para Codex y un registro de handoff compatible con Claude Code.
- Cambios: agregado `AGENTS.md` con reglas de contexto, colaboración, economía de tokens, auth, multi-tenancy, zonas estables y verificación. `CLAUDE.md` ahora referencia el worklog compartido.
- Archivos: `AGENTS.md`, `CLAUDE.md`, `docs/AI_WORKLOG.md`, `docs/README.md`
- Verificacion: no ejecutada; solo documentación.
- Pendiente: mantener `AGENTS.md` y `CLAUDE.md` sincronizados cuando cambien reglas críticas.

## 2026-05-16 - Codex - Auditoría base pre-roadmap

- Objetivo: revisar errores de código y conceptuales antes de seguir con el roadmap.
- Cambios: corregido `useSessionHistory` con `useSyncExternalStore`; endurecido `/api/admin/patterns` para admin; agregado helper `isAtLeast`; ajustado prompt para no mencionar tools inexistentes de clima/HSE; eliminado fetch externo de Google Fonts en build; endurecido secreto de reset password en producción.
- Archivos: `src/hooks/useSessionHistory.ts`, `src/app/api/admin/patterns/route.ts`, `src/app/dashboard/admin/patterns/page.tsx`, `src/lib/auth/require-auth.ts`, `src/lib/ai/agent-prompt.ts`, `src/lib/auth/reset-token.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `.env.local.example`, `.env.docker.example`, `ROADMAP.md`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK con permisos fuera del sandbox.
- Pendiente: consolidar migraciones duplicadas `db/migrations/` vs `migrations/`; agregar tests unitarios; conectar fuente real de clima/HSE si se quiere reactivar esas capacidades como tools.

## 2026-05-16 - Codex - Refinamiento visual dashboard

- Objetivo: mejorar el estilo visual de la experiencia principal sin cambiar flujos de negocio.
- Cambios: agregado fondo técnico tipo blueprint, sidebar más denso, navegación activa más clara, header/input con superficie translúcida, dropzones y chips visuales más sobrios, radios reducidos y sombras más controladas.
- Archivos: `src/app/globals.css`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/chat/page.tsx`, `src/components/chat/AgentGreeting.tsx`, `src/components/chat/ChatInput.tsx`, `src/components/chat/NavLink.tsx`, `src/components/chat/OrganizationCard.tsx`, `src/components/chat/SessionSidebar.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK; servidor local activo en `http://localhost:3000`.
- Pendiente: hacer QA visual manual autenticado en `/dashboard/chat` con datos reales de una organización.

## 2026-05-16 - Codex - Refinamiento visual login

- Objetivo: alinear la pantalla de login con el nuevo lenguaje visual del dashboard.
- Cambios: `AuthLayout` ahora usa fondo blueprint, columna editorial desktop y panel translúcido; `login/page.tsx` tiene encabezado operativo, badge de sesión protegida, inputs con iconos y CTA más claro. Copy ajustado a un tono más técnico y atractivo para usuarios finales: centro operativo, decisiones críticas, trazabilidad técnica y legajos consultables.
- Archivos: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK; `GET /login` responde 200 en `http://127.0.0.1:3000/login`.
- Pendiente: QA visual manual en mobile/desktop.

## 2026-05-16 - Codex - Header chat y modelo DeepSeek

- Objetivo: recuperar el espacio vertical ocupado por el topbar de configuración y corregir el label del modelo.
- Cambios: `TopBarActions` se movió al header del chat, a la izquierda del badge de modelo; el topbar desktop vacío se eliminó y solo queda barra móvil; el badge ahora dice `DeepSeek V4 Flash`; default `AI_MODEL` actualizado a `deepseek-v4-flash`.
- Archivos: `src/app/dashboard/layout.tsx`, `src/app/dashboard/chat/page.tsx`, `src/lib/ai/agent-prompt.ts`, `.env.docker.example`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: si `.env.local` define `AI_MODEL=deepseek-chat`, cambiarlo manualmente a `deepseek-v4-flash` para que runtime y UI queden alineados.

## 2026-05-16 - Codex - Saludo con nombre de pila confiable

- Objetivo: evitar que el greeting use correos o aliases como nombre del usuario.
- Cambios: `/api/auth/me` expone `displayName` si el JWT/perfil trae nombre real; `AgentGreeting` usa nombre de pila solo si viene de perfil o si el email parece claramente humano compuesto (`nombre.apellido`). Si no hay confianza, saluda sin nombre.
- Archivos: `src/lib/auth/jwt.ts`, `src/app/api/auth/me/route.ts`, `src/types/index.ts`, `src/app/dashboard/chat/page.tsx`, `src/components/chat/AgentGreeting.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: si InsForge no incluye el nombre en el JWT, considerar guardar `display_name` en `organization_members` o una tabla `user_profiles`.

## 2026-05-16 - Codex - Concepto Contexto Empresarial

- Objetivo: ampliar el concepto de Base Documental hacia lanzamiento empresarial.
- Cambios: agregado `docs/06_enterprise_context_layer.md`; README y roadmap ahora reflejan que EdificIA debe conectarse de forma segura a fuentes empresariales, extraer obras activas, clasificar documentos y auditar una constructora completa.
- Archivos: `docs/06_enterprise_context_layer.md`, `docs/README.md`, `README.md`, `ROADMAP.md`
- Verificacion: no ejecutada; solo documentación de producto/arquitectura.
- Pendiente: convertir esta visión en esquema de DB para conectores, inventario, entidades empresariales y sync runs.

## 2026-05-16 - Codex - Lectura agéntica de documentos

- Objetivo: evitar que el agente parezca un programa hardcodeado que solo corre tools fijas.
- Cambios: agregado `docs/07_agentic_document_reading.md`; prompt actualizado con ciclo de clasificación, hipótesis, extracción, contraste, verificación y síntesis; labels visibles de tools ahora comunican lectura/contraste en vez de reglas internas.
- Archivos: `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `docs/07_agentic_document_reading.md`, `docs/README.md`, `ROADMAP.md`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: diseñar tools semánticas futuras como `clasificar_documento_obra`, `extraer_metadatos_documento` y `comparar_documento_con_contexto`.

## 2026-05-16 - Claude - Memoria de usuario activa (recentSessions proactivas)

- Objetivo: surfacear `recentSessions` proactivamente en vez de solo cuando el usuario las pide (roadmap §2.1, 🟡 S).
- Cambios: `buildSystemPrompt` ahora marca cada sesión con `· esta obra` (si coincide `project_id`) y `· vieja` (>7 días). La instrucción pasó de reactiva ("SI el usuario pregunta") a proactiva: abrir reconociendo sesión previa cuando llega archivo del mismo `file_type` de la misma obra, u ofrecer continuidad ante consultas generales. Sesiones viejas o de otra obra solo si el usuario lo pide.
- Archivos: `src/lib/ai/agent-prompt.ts`
- Verificacion: `npm run type-check` OK.
- Pendiente: validar UX con sesión real (subir un excel a obra que ya tuvo otro excel auditado y confirmar que el agente abre con "noté que…").

## 2026-05-16 - Claude - Correlation IDs en logger Pino

- Objetivo: trackear request end-to-end inyectando `requestId` en el contexto Pino (roadmap §2.3, 🟡 S).
- Cambios: `proxy.ts` ahora genera/respeta `x-request-id` por request, lo propaga a la route via `NextResponse.next({ request: { headers } })` y lo expone en la response (header + CORS expose). `logger.ts` agrega `getRequestLogger(req, base?)` que devuelve un child logger con `requestId`. Pilot aplicado en `api/chat`: `aiLogger` ahora se vincula al requestId en `onFinish` y en el catch de errores.
- Archivos: `src/proxy.ts`, `src/lib/logger.ts`, `src/app/api/chat/route.ts`
- Verificacion: `npm run type-check` OK.
- Pendiente: adopción incremental en las otras 30 routes (`api/upload`, `api/projects/*`, `api/documents/*`, etc.) — el helper ya está listo, solo cambiar el import y vincular.

## 2026-05-16 - Claude - Sub-organizar src/components/chat/

- Objetivo: dividir los 22 archivos sueltos en sub-carpetas semánticas (roadmap §2.3, 🟢 S).
- Cambios: tres nuevas sub-carpetas vía `git mv` (preserva history):
  - `chat/sidebar/` (10): DashboardSidebar, SessionSidebar, ActiveProjectSection, NavLink, AdminNavLink, OrganizationCard, MobileMenuButton, MobileSidebarOverlay, UserMenu, TopBarActions.
  - `chat/input/` (2): ChatInput, DropZone.
  - `chat/cards/` (7): FileCard, FileReadyView, DocumentProposalCard, GeneratedDocCard, FindingCallout, ComparisonTable, ChartBlock.
  - Quedan en raíz `chat/`: AgentGreeting, MessageBubble, DxfViewerModal + sub-carpeta `blocks/` (ya existente).
  Imports actualizados en `dashboard/layout.tsx`, `dashboard/chat/page.tsx` y `MessageBubble.tsx`.
- Archivos: `src/components/chat/**/*.tsx` (22 moves), `src/app/dashboard/layout.tsx`, `src/app/dashboard/chat/page.tsx`, `src/components/chat/MessageBubble.tsx`
- Verificacion: `npm run type-check` OK; `npm run lint` OK.
- Pendiente: ninguno.

## 2026-05-16 - Claude - WAL verification en PostgreSQL self-hosted

- Objetivo: dejar el WAL del cluster auditable y con configuración explícita para self-hosted (roadmap §1.1, 🟢 S).
- Cambios: `docker-compose.yml` ahora pasa `POSTGRES_INITDB_ARGS=--data-checksums`, un `command:` con `wal_level=replica`, `wal_compression=on`, tamaños de WAL y `log_checkpoints=on`, y un healthcheck extendido que valida `pg_current_wal_lsn() IS NOT NULL`. Nuevo `scripts/verify-wal.sh` (con o sin `--docker`) reporta `data_checksums`, `wal_level`, `synchronous_commit`, avance de LSN entre dos muestras, conteo/tamaño de WAL files y último checkpoint; sale != 0 si detecta config insegura.
- Archivos: `docker-compose.yml`, `scripts/verify-wal.sh` (nuevo)
- Verificacion: YAML válido (`js-yaml`), bash `set -e` syntax OK (`bash -n`). No pude correr `docker compose config` ni el script en vivo (no hay daemon docker local).
- Pendiente: si el cluster ya está inicializado sin `--data-checksums`, requiere downtime y `pg_checksums --enable` para activarlos. Documentado dentro del compose.

## 2026-05-16 - Claude - Plan-then-execute + Self-critique en el agente

- Objetivo: cerrar §2.1 del roadmap (🔥 M cada uno) sumando estructura agéntica al prompt y exponiendo el plan en la UI.
- Cambios:
  - **Prompt**: nueva sección "Plan antes de invocar herramientas" que pide un bloque `<plan>{"hipotesis":"…","steps":[{tool,why,expected}]}</plan>` antes de la primera tool del turno (solo si va a llamar >1 tool, máx 5 steps, sin tools de generación). Nueva sección "Auto-verificación antes de cerrar" con checklist de 5 puntos (números atados a tools, aritmética interna, fuentes citadas, coherencia con plan, hallazgos no duplicados).
  - **UI**: nuevo `cards/PlanBlock.tsx` con `PlanBlock`, `PlanPendingPlaceholder` y `extractPlan(text)`. Maneja streaming parcial: mientras `<plan>` está abierto sin cierre, oculta el JSON crudo y muestra un placeholder "Planificando auditoría…". `MessageBubble.TextPart` ahora separa el plan del texto markdown.
- Archivos: `src/lib/ai/agent-prompt.ts`, `src/components/chat/cards/PlanBlock.tsx` (nuevo), `src/components/chat/MessageBubble.tsx`
- Verificacion: `npm run type-check` OK; `npm run lint` OK.
- Pendiente: medir empíricamente si DeepSeek respeta el contrato del plan en obras reales; si lo ignora, considerar pasar el plan a structured-output (segunda llamada con `output: 'object'`).

## 2026-05-16 - Claude - Confidence + provenance en respuestas

- Objetivo: cada cifra crítica del resumen lleva fuente documental y tool de cómputo (roadmap §2.1, 🟢 M).
- Cambios: `agent-prompt.ts` agrega sección "Provenance de cifras" con formato canónico ``valor · `tool_nombre` · «doc»`` y reglas (aplicar a cifras decisivas, dos tools si es derivada, no escribir el número si no podés citar la tool). La checklist de auto-verificación pasó "fuentes citadas" a "provenance dual".
- Archivos: `src/lib/ai/agent-prompt.ts`
- Verificacion: `npm run type-check` OK.
- Pendiente: validar que DeepSeek respete el formato en obras reales; si la prosa lo opaca, considerar parsear inline en `MessageBubble` para resaltar las citas.

## 2026-05-16 - Claude - PII scanning en uploads

- Objetivo: detectar CUIT/CUIL/DNI/CBU/email/teléfono en archivos subidos y advertir al admin (roadmap §2.5, 🟡 M).
- Cambios: nuevo `src/lib/security/pii-detector.ts` con `scanForPii(text)` y validación de checksum para CUIT (módulo 11) y CBU (módulo 10 por bloques). DNI requiere contexto léxico ("DNI", "documento") para evitar falsos positivos con códigos de ítem. Devuelve conteos y samples anonimizadas. `/api/upload` ahora ejecuta el scan sobre el texto auditable del archivo (excel: descripciones, pdf/docx: full text, dxf: annotations), retorna `piiScan` en la response y loguea warning con `getRequestLogger`. Nuevo banner `PiiWarningBanner` en `FileReadyView` muestra el resumen al usuario antes de auditar. `AttachedFile` en `chat/page.tsx` extendido con `piiScan?`.
- Archivos: `src/lib/security/pii-detector.ts` (nuevo), `src/app/api/upload/route.ts`, `src/components/chat/cards/FileReadyView.tsx`, `src/app/dashboard/chat/page.tsx`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; sanity test inline con `tsx`: CUIT válido (20-12345678-6) detecta, CUIT inválido descarta, DNI con/sin label distingue, CBU/email/teléfono OK.
- Pendiente: persistir `piiScan` cuando se implemente audit log (task siguiente) para tener histórico. La columna en `uploaded_files` se evita por ahora porque hay duplicación pendiente en `db/migrations` vs `migrations/`.

## 2026-05-16 - Codex - Sincronización guías IA y limpieza

- Objetivo: asegurar que Claude Code y Codex entiendan las nuevas decisiones de producto.
- Cambios: `CLAUDE.md` y `AGENTS.md` ahora referencian Contexto Empresarial y Lectura Agéntica como decisiones vigentes. Eliminada carpeta local ignorada `.claude-flow/`. Eliminados artifacts locales `.next/` y `tsconfig.tsbuildinfo`. Corregidas referencias obsoletas a `src/middleware.ts`; el guard activo es `src/proxy.ts`.
- Archivos: `CLAUDE.md`, `AGENTS.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `find` no muestra restos `.claude-flow`, `.swarm`, `agentdb`, `ruvector`, `mcp-servers` ni carpetas de agentes ignoradas. Puerto 3000 libre. `.next/` y `tsconfig.tsbuildinfo` eliminados.
- Pendiente: ninguno de limpieza local detectado.

## 2026-05-16 - Codex - Schemas Zod para responses críticas

- Objetivo: reducir drift cliente-servidor tipando respuestas API consumidas por la UI (roadmap §2.3, 🟡 M).
- Cambios: nuevo `src/lib/validators/api-responses.ts` con contratos para errores estándar, `upload`, `auth/*`, `projects`, `project details/files`, `sessions`, `documents`, `documents/save`, `indices`, `indices/upload`, `admin/*` y `super-admin/*`. Las routes validan antes de responder en esos endpoints; los hooks/clientes dejan de castear JSON crudo y parsean con Zod. `/api/upload` ahora falla con log si el shape procesado no coincide con el contrato. `generate/*` queda fuera porque responde binarios (`xlsx`, `docx`, `pdf`), no JSON.
- Archivos: `src/lib/validators/api-responses.ts`, `src/lib/validators/index.ts`, `src/app/api/upload/route.ts`, `src/app/dashboard/chat/page.tsx`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/orgs/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/(auth)/register/page.tsx`, `src/hooks/useOrgMember.ts`, `src/hooks/useOrgs.ts`, `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/files/route.ts`, `src/hooks/useProjects.ts`, `src/hooks/useProjectDetails.ts`, `src/hooks/useProjectFiles.ts`, `src/app/api/sessions/route.ts`, `src/hooks/useSessionHistory.ts`, `src/app/api/documents/route.ts`, `src/app/api/documents/save/route.ts`, `src/app/dashboard/documents/page.tsx`, `src/components/chat/cards/DocumentProposalCard.tsx`, `src/app/api/indices/route.ts`, `src/app/api/indices/upload/route.ts`, `src/hooks/usePriceIndices.ts`, `src/app/api/admin/members/route.ts`, `src/app/api/admin/patterns/route.ts`, `src/app/api/admin/settings/route.ts`, `src/app/dashboard/admin/page.tsx`, `src/app/dashboard/admin/patterns/page.tsx`, `src/app/dashboard/admin/settings/page.tsx`, `src/app/api/super-admin/companies/route.ts`, `src/app/api/super-admin/founders/route.ts`, `src/app/api/super-admin/members/route.ts`, `src/app/api/super-admin/reset/route.ts`, `src/app/super-admin/page.tsx`, `docs/04_architecture_map.md`, `ROADMAP.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK.
- Pendiente: evaluar helper común `apiJson(schema, payload)` si la repetición crece; no hay JSON responses principales pendientes.

## 2026-05-16 - Codex - Audit log inmutable

- Objetivo: dejar un registro write-once para eventos legales/operativos de auditoría (roadmap §2.5, 🟢 M).
- Cambios: nuevas migraciones `016_immutable_audit_log.sql` y `20260516140000_immutable-audit-log.sql` crean `audit_log_events` con hash encadenado por organización, RLS de lectura y triggers que bloquean `UPDATE`/`DELETE`. Nuevo writer `writeAuditLogEvent()` inserta eventos server-side. `/api/upload` registra `upload.file_ready` o `upload.pii_detected` y persiste `piiScan`; `/api/chat` registra `chat.completed` con modelo, steps, usage y latencia. Roadmap actualizado: PII y audit log cerrados; Zod queda parcial.
- Archivos: `db/migrations/016_immutable_audit_log.sql`, `migrations/20260516140000_immutable-audit-log.sql`, `src/lib/audit/audit-log.ts`, `src/app/api/upload/route.ts`, `src/app/api/chat/route.ts`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npx @insforge/cli db migrations up --all --json` aplicó `20260516140000_immutable-audit-log`; `npx @insforge/cli db migrations list --json` confirma que figura aplicada.
- Pendiente: cuando se consoliden migraciones, decidir si queda canónico `db/migrations/` o `migrations/`.

## 2026-05-16 - Codex - Consolidación de migraciones

- Objetivo: eliminar la duplicación activa entre `db/migrations/` y `migrations/` (roadmap §2.3, 🔥 S).
- Cambios: `migrations/` queda como ruta canónica vía InsForge CLI. Las raw SQL previas se movieron a `docs/archive/db-migrations-legacy/` como histórico read-only. `Dockerfile` ya no ejecuta migraciones al arrancar y `scripts/migrate.js` queda como aviso hacia `npm run migrate`. `AGENTS.md`, `CLAUDE.md`, `ROADMAP.md` y mapa de arquitectura actualizados.
- Archivos: `migrations/`, `docs/archive/db-migrations-legacy/`, `Dockerfile`, `scripts/migrate.js`, `AGENTS.md`, `CLAUDE.md`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `node scripts/migrate.js` OK; `npm run migrate -- --json` OK sin pendientes (`appliedMigrations: []`).
- Pendiente: ninguno de migraciones activas; mantener cambios futuros exclusivamente en `migrations/`.

## 2026-05-16 - Codex - Onboarding forzado de índices

- Objetivo: evitar que `comparar_con_indices` quede sin valor en organizaciones sin índices cargados (roadmap §2.4, 🔥 S).
- Cambios: `ChatPage` consulta `usePriceIndices()` y, si el usuario es admin y no hay registros activos, muestra un banner operativo con acceso directo a `/dashboard/admin/indices`. `ROADMAP.md` marca el ítem como completado.
- Archivos: `src/app/dashboard/chat/page.tsx`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK.
- Pendiente: QA visual autenticado en org nueva sin índices para confirmar que el banner no tapa flujos de subida.

## 2026-05-16 - Codex - Tests unitarios base

- Objetivo: empezar cobertura real en auditoría financiera (roadmap §2.3, 🔥 M).
- Cambios: agregado script `npm test` con `node:test` y loader mínimo para resolver imports `.ts`. Nueva suite de `math-engine` cubre cálculo de líneas, costo directo, incidencia, cierre de total y reglas críticas. Nueva suite de `excel/parser` cubre números argentinos y extracción de una planilla XLSX generada en memoria.
- Archivos: `package.json`, `tests/register-ts-loader.mjs`, `tests/ts-resolve-loader.mjs`, `tests/math-engine.test.mjs`, `tests/excel-parser.test.mjs`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm test` OK (8 tests); `npm run type-check` OK; `npm run lint` OK.
- Pendiente: ampliar fixtures con presupuestos reales anonimizados cuando haya dataset autorizado.

## 2026-05-16 - Codex - Contradicciones al subir

- Objetivo: flaguear inconsistencias automáticas contra documentos previos al ingresar un archivo (roadmap §2.2, 🔥 M).
- Cambios: nuevo `scanDocumentContext()` compara señales fuertes del archivo nuevo contra `document_chunks` de la misma obra/org: total de presupuesto Excel, monto principal en PDF/DOCX y área total DXF. `/api/upload` devuelve `contextScan`, lo registra en logs/audit payload y `FileReadyView` muestra banner de contradicciones. `__file_meta__` incluye `contextFindings` para que el agente los trate como riesgo preliminar. Schema `uploadResponseSchema` extendido.
- Archivos: `src/lib/document-intelligence/context-scan.ts`, `src/app/api/upload/route.ts`, `src/lib/validators/api-responses.ts`, `src/components/chat/cards/FileReadyView.tsx`, `src/app/dashboard/chat/page.tsx`, `src/lib/ai/agent-prompt.ts`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK.
- Pendiente: mejorar con grafo `obra_relations` cuando exista el modelo relacional; hoy es heurístico conservador basado en señales numéricas.

## 2026-05-16 - Codex - Arquitectura de datos extendida de obra

- Objetivo: crear la base relacional multi-tenant para cronograma, curva S, subcontratos, HSE y acopios (roadmap §1.3, 🔥 L).
- Cambios: nueva migración InsForge `20260516215250_project-operations-schema.sql` crea `project_schedule_tasks`, `project_financial_snapshots`, `project_subcontracts`, `project_hse_records` y `project_supply_items` con `organization_id`, `project_id`, soft-delete, índices operativos y RLS por membresía. `projects.status` se corrigió del constraint legacy (`active/archived/deleted`) a `en_obra/planificacion/finalizado/pausado`. Tipos compartidos agregados en `src/types/index.ts`.
- Archivos: `migrations/20260516215250_project-operations-schema.sql`, `src/types/index.ts`, `docs/04_architecture_map.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run migrate -- --json` aplicó la migración; `db tables`, `db policies` y query de constraint confirmaron tablas/RLS/estado. `npm run type-check` OK; `npm run lint` OK; `npm test` OK.
- Pendiente: construir APIs/tools y workers proactivos que lean/escriban estas tablas; hoy el esquema queda listo pero sin UI CRUD específica.

## 2026-05-16 - Codex - Motor de proactividad base

- Objetivo: empezar el worker diario sobre obras activas (roadmap §1.3, 🔥 L) usando la nueva arquitectura operativa.
- Cambios: `runDailyProjectScan()` recorre obras `en_obra`/`planificacion`, detecta riesgos de cronograma vencido/bloqueado, HSE vencido/no conforme, suministros demorados, desvíos de curva S y falta de documentación reciente. `/api/cron/project-proactivity` expone la ejecución con `CRON_SECRET`/Bearer y escribe resumen por obra en `audit_log_events`.
- Archivos: `src/lib/proactivity/daily-scan.ts`, `src/app/api/cron/project-proactivity/route.ts`, `src/lib/validators/api-responses.ts`, `.env.local.example`, `.env.docker.example`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK; smoke `POST /api/cron/project-proactivity` con `limit:1` respondió 200.
- Pendiente: crear schedule InsForge solo cuando `NEXT_PUBLIC_APP_URL` sea una URL pública alcanzable, y luego mostrar alertas en UI.

## 2026-05-16 - Codex - Clima real con Open-Meteo

- Objetivo: reemplazar el pendiente/mock de clima por una tool real para impacto meteorológico de obra.
- Cambios: nuevo `src/lib/weather/open-meteo.ts` resuelve ubicación por geocoding Open-Meteo o coordenadas y consulta forecast diario; clasifica riesgo por lluvia, viento, ráfagas y temperatura para tareas de obra. Nueva tool `evaluar_impacto_clima` expuesta al agente y prompt actualizado para usarla.
- Archivos: `src/lib/weather/open-meteo.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `ROADMAP.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK; smoke directo contra Open-Meteo para `Cordoba, Argentina` OK (7 días de forecast).
- Pendiente: si se necesita precisión contractual, parametrizar umbrales por tipo de tarea y pliego.

## 2026-05-17 - Claude - 5 tools writer + step budget tier-aware + expansión roadmap (roadmap §1.3, §2.1, §2.2, §2.4)

- Objetivo: cerrar asimetría reader/writer del agente (las tools recientes solo leían tablas que nadie llenaba) y agregar capacidades agénticas observables. Expandir el roadmap con la próxima ola de mejoras agénticas.
- Cambios:
  - **Tool writer `registrar_snapshot_financiero`**: escribe a `project_financial_snapshots`. Upsert por `(organization_id, project_id, snapshot_date)`. Acepta planned/actual/committed/invoiced/paid + currency. Source siempre `agent`. Audit log `financial.snapshot_registered` / `financial.snapshot_updated`. Cierra el gap de `auditar_curva_inversion` (que leía nada).
  - **Tool writer `registrar_hse_record`**: escribe a `project_hse_records`. Cálculo automático de status desde `expiresAt`: `valid` >14d, `expiring` ≤14d, `expired` si vencido. Acepta subjectName / subcontractorName / workerIdentifier (al menos uno requerido). Audit log `hse.record_registered`.
  - **Tool writer `registrar_acopio`**: modo `create` (insert si no existe item con mismo nombre, ilike) o `update` (patch del row existente). Status inferido por `computeSupplyStatus()` extraído a `supply-status.ts` (módulo puro testeable). Audit log `supply.item_registered` / `supply.item_updated`.
  - **Tool writer `resolver_relacion_documental`**: cierra el knowledge graph. Action `confirm` eleva confidence a 1 y `detected_by=user`. Action `dismiss` soft-deletea con metadata.resolution. Action `supersede` crea nueva relación `supersedes` en sentido inverso y descarta la original. Audit log `obra_relation.{confirmed,dismissed,superseded}`.
  - **Tool reader `resumen_diario_obra`**: agregador atómico. Consolida tareas (overdue / due_today / due_soon / blocked), HSE (expired / expiring ≤7d / incident), acopios (delayed / upcoming ≤14d), último snapshot financiero con desvío, alertas top de proactivity y clima del día opcional (via Open-Meteo si se pasa `includeWeather`). Devuelve summary string compacto + colecciones para render. PM-friendly briefing en un solo llamado.
  - **Step budget tier-aware**: `/api/chat` ahora calcula `stepBudget = route.tier === "deep" ? 35 : 20` y lo pasa a `stopWhen: stepCountIs(stepBudget)`. El budget se loguea con el routing y se persiste en `audit_log_events.payload.stepBudget`. Auditorías complejas dejan de cortarse antes de cerrar el resumen.
  - **Prompt**: nueva sección "Capturar datos operativos cuando el usuario los informa" explica cuándo usar las 4 tools de write (snapshot financiero, HSE, acopio, reprogramación) — regla central: si el usuario da cifra concreta con sujeto y fecha, registrala; si es ambiguo, NO inventes. Nueva sección "Brief diario de obra" instruye `resumen_diario_obra` ante preguntas operativas amplias. Sección de knowledge graph ampliada con `resolver_relacion_documental`.
  - **Labels UI** en `MessageBubble.tsx` para las 5 tools nuevas.
  - **Tests**: `tests/project-writers.test.mjs` cubre `computeSupplyStatus` (5 casos: received, partial, ordered, planned, default). Total 27 tests.
  - **ROADMAP expandido**: §1.3 marcadas las 5 tools writer completadas + bullets nuevas para `generar_orden_compra`, `generar_acta_obra`, `enviar_email_stakeholder`, `registrar_subcontrato`, `auditar_subcontratos`. §2.1 sumadas mejoras agénticas pendientes: hypothesis branching, retry strategy, tool telemetry, memoria activa escribible. §2.2 knowledge graph desdoblado en lectura ✅ / resolución ✅ / extensión semántica 🟡 / UI exploratoria 🟢. §2.4 UX explainability: confidence visible 🟡, "por qué" expandible 🟡, replay de auditoría 🟡, "Día en la obra" dashboard 🟢.
- Archivos: `src/lib/project-operations/writers.ts` (nuevo, 5 helpers), `src/lib/project-operations/supply-status.ts` (nuevo, helper puro), `src/lib/project-operations/daily-brief.ts` (nuevo), `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/app/api/chat/route.ts`, `src/components/chat/MessageBubble.tsx`, `tests/project-writers.test.mjs` (nuevo), `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (27/27, +6 desde la corrida anterior).
- Pendiente: las 5 tools no tienen tests de integración contra DB real (solo `computeSupplyStatus` puro). Cuando se haya datos en una org de staging, validar que `audit_log_events` registra los eventos correctos y que el agente respeta las reglas del prompt (no inventar). El bullet "Día en la obra" del roadmap §2.4 (UI espejo del `resumen_diario_obra`) queda pendiente.

## 2026-05-16 - Claude - Knowledge graph obra_relations (roadmap §2.2)

- Objetivo: cerrar el item 🔥 L "Knowledge graph de obra" del ROADMAP §2.2. Modela relaciones entre documentos para responder "¿qué docs se contradicen?" y trazabilidad de versiones.
- Cambios:
  - **Migración**: `migrations/20260516223000_obra-relations.sql` crea `obra_relations` con FKs a `organizations`, `projects` y `uploaded_files`, check de tipos (`contradicts/derives_from/supersedes/references/duplicates`), confianza 0–1, `detected_by` (`system/agent/user`), evidencia JSONB. Constraint `source <> target` y unique parcial para `detected_by='system'` (evita duplicados de auto-scan reentrantes). RLS por membership (select org, insert/update editor, delete admin). Aplicada via `npm run migrate`.
  - **Helpers**: `src/lib/knowledge-graph/relations.ts` con `upsertObraRelation` (system → upsert por unique parcial; agent/user → insert), `writeRelationsFromContextScan` (escribe `contradicts` desde `ContextScanResult` con confidence 0.85 si severity=error, 0.6 si warning), `queryObraRelations` (resuelve por `fileId` o `fileName` ilike, hidrata nombres en una query secundaria, devuelve relaciones con dirección outgoing/incoming).
  - **Auto-populate**: `/api/upload` ahora llama a `writeRelationsFromContextScan` cuando `contextScan.hasFindings && fileId`. Las contradicciones detectadas en la subida quedan automáticamente en el graph sin acción del usuario.
  - **Tool agente nueva**: `buscar_relaciones_documento({ fileId? | fileName?, projectId?, relationType?, limit? })` registrada en `agentTools` y bound version (sin organizationId en schema). Resolve nombre parcial → último match, devuelve `relationsCount`, `relations[]` con `direction`, `counterpart`, `evidence`, `detectedBy`, `confidence`. Label UI agregado en `MessageBubble.tsx`.
  - **Prompt**: nueva sección "Knowledge graph de obra" instruye al agente a usar la tool ante consultas de trazabilidad/contradicciones y le recuerda no inventar relaciones que la tool no devolvió.
- Archivos: `migrations/20260516223000_obra-relations.sql` (nuevo), `src/lib/knowledge-graph/relations.ts` (nuevo), `src/app/api/upload/route.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run migrate -- --json` aplicó la migración OK; `npm run type-check` OK; `npm run lint` OK; `npm test` OK (21 tests, suites previas verdes).
- Pendiente: UI de exploración del graph (ver todas las relaciones de una obra, navegar por tipo). Hoy se consultan via chat con la nueva tool. Las relaciones `derives_from`, `supersedes` y `references` quedan en la tabla y disponibles para el agente, pero no hay autopopulate todavía — se llenan a pedido del agente cuando un usuario lo indique, o manualmente vía SQL.

## 2026-05-16 - Claude - Router de modelos por complejidad (roadmap §2.1)

- Objetivo: cerrar el item 🟡 M "Router de modelos" del ROADMAP §2.1. Habilita escalar a un modelo más caro/profundo solo cuando la complejidad del turno lo justifica, sin instalar nuevas SDKs.
- Cambios:
  - **Router**: `src/lib/ai/model-router.ts` exporta `routeModel(messages)` que devuelve `{ tier: "fast"|"deep", model, reason, signals }`. Heurística por señales: `hasAvsBCompare` (+3, regex `A vs B` o mención de `comparar_presupuestos`), `hasContradictionIntent` (+2), `hasCrossDocIntent` (+2), `deepHinted` (+2, keywords "razonamiento profundo"), `longTurn >8000 chars` (+1), `hasFileAttachment` (+1). Umbral: score ≥ 3 → deep.
  - **Modelos**: `AI_MODEL_FAST` y `AI_MODEL_DEEP` via env. Si no se setean, ambos caen al `AI_MODEL` existente — el router queda armado para que cuando se agregue una API key Anthropic/otro proveedor solo haya que setear `AI_MODEL_DEEP` y conectar al provider correspondiente, sin tocar la lógica del chat. `.env.local.example` y `.env.docker.example` documentan ambas vars.
  - **Wiring**: `/api/chat` reemplaza `AI_MODEL` constante por `route.model`, loguea la decisión (`tier`, `model`, `reason`, `signals`) y persiste `tier` + `routeReason` en el payload de `chat.completed` del audit log. Removida la importación directa de `AI_MODEL` en `route.ts` (ahora vive solo en el router).
  - **Tests**: nuevo `tests/model-router.test.mjs` con 5 casos (baseline → fast, A vs B → deep, contradicción + cross-doc → deep, archivo + turno largo solos → fast, hint explícito + archivo → deep).
- Archivos: `src/lib/ai/model-router.ts` (nuevo), `src/app/api/chat/route.ts`, `.env.local.example`, `.env.docker.example`, `tests/model-router.test.mjs` (nuevo), `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (5/5 del router, 21/21 total).
- Pendiente: agregar `@ai-sdk/anthropic` (o equivalente) y un binding tipo `deep.chat(model)` para que `AI_MODEL_DEEP` apunte a Claude Sonnet 4.6 real. Requiere autorización para instalar dep y `ANTHROPIC_API_KEY` activa.

## 2026-05-16 - Claude - Cronograma real - CSV import (roadmap §2.2)

- Objetivo: cerrar el item 🟡 M "Cronograma real (no demo)" del ROADMAP §2.2. Con esto `proyectar_cronograma` tiene una fuente real y `reprogramar_e_informar` algo que tocar.
- Cambios:
  - **Parser**: `src/lib/schedule/csv-importer.ts` exporta `tokenizeCsv(text)` (RFC4180-ish: quotes, embedded commas/newlines/quotes escapadas) y `parseScheduleCsv(text)`. Columnas reconocidas con aliases ES/EN: `task_code` (codigo/code), `name` (nombre/tarea), `description`, `status`, `start_date` (inicio/fecha_inicio), `due_date` (fin/vencimiento), `progress_pct` (avance), `predecessor_code`. Fechas: ISO YYYY-MM-DD o DD/MM/YYYY → normalizadas a ISO. Status: aliases en español (`en_curso`, `bloqueada`, `completada`, …) → valores canónicos del check constraint. Si `status='done'`, fuerza `progress_pct=100`. Sin deps nuevas — el parser CSV se escribió en TS puro.
  - **Endpoint**: `POST /api/projects/[id]/schedule/import` con `requireAuth(req, { role: "engineer" })`, rate limit estándar, multipart (form `file` + `mode`) o JSON (`csv`, `mode`, `fileName`). `mode='replace'` soft-deletea el cronograma existente antes de insertar. Inserta en `project_schedule_tasks` y resuelve `predecessor_task_id` en pasada secundaria por `predecessor_code`. Cap 500 tareas, 2MB. Audit log `schedule.csv_import` con conteos y warnings.
  - **Schema**: nuevo `scheduleImportResponseSchema` en `validators/api-responses.ts`.
  - **UI**: `src/app/dashboard/obras/[id]/_components/ScheduleImportSection.tsx` agrega sección "Cronograma de obra" abajo del grid documentos/cobertura. Radio append/replace, ejemplo CSV plegable, dropzone (input oculto + botón "Subir CSV"), reporte de filas insertadas y warnings de parseo. Integrado en `obras/[id]/page.tsx`.
  - **Tests**: `tests/schedule-csv-importer.test.mjs` con 6 casos (tokenizer con comillas/newlines, header español con fechas mixtas, falta de columna obligatoria, status=done fuerza 100%, dedupe de códigos con warning, fecha inválida no aborta).
- Archivos: `src/lib/schedule/csv-importer.ts` (nuevo), `src/app/api/projects/[id]/schedule/import/route.ts` (nuevo), `src/lib/validators/api-responses.ts`, `src/app/dashboard/obras/[id]/_components/ScheduleImportSection.tsx` (nuevo), `src/app/dashboard/obras/[id]/page.tsx`, `tests/schedule-csv-importer.test.mjs` (nuevo), `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (15/15 con las nuevas; total 21/21 al sumar el router).
- Pendiente: import MS Project (.mpp es binario propietario; .xml de MS Project sería viable pero scope distinto). Builder manual desde la UI también pendiente — hoy el flujo es CSV o INSERT directo via tool del agente.

## 2026-05-16 - Claude - Side-by-side upload A vs B (roadmap §2.4)

- Objetivo: cerrar el ítem 🟡 M "Side-by-side upload (A vs B)" del ROADMAP §2.4. La tool `comparar_presupuestos` ya existe; faltaba la UI para subir dos archivos a la vez y disparar la comparativa en un mismo turno.
- Cambios:
  - **State**: nuevo `pendingB: PendingFile | null` en `dashboard/chat/page.tsx` que vive en paralelo a `pending`. Se limpia en cada switch de sesión, al subir un nuevo archivo A (la comparativa se invalida) y al `handleRemoveFile`.
  - **FileReadyView**: prop opcional `onStartComparison?: () => void`. Cuando el archivo A es Excel, debajo de las acciones aparece un CTA dashed "Comparar con otra versión (A vs B)" con ícono `GitCompare`. Click → dispara el input file oculto (`accept=".xlsx,.xls,.xlsm,..."`).
  - **ComparisonReadyView** (componente nuevo): renderiza ambas tarjetas en grilla 2-col con label "Versión A/B", muestra delta de total declarado con tono semántico (rojo si B > A, verde si B < A, neutro si falta), y un CTA primario "Auditar comparativa A vs B".
  - **Prompt dual**: nueva `buildComparisonPrompt(a, b)` arma un único mensaje con ambos `__file_meta__`, ambos `cacheId`, totales declarados y un plan de 7 pasos: `calcular_totales` x2, `validar_cierre_de_total` x2, `detectar_exclusiones_logicas` x2 y `comparar_presupuestos` con rows canónicas (total declarado, costo directo, ítems, errores, warnings, brecha A→B) más resumen ejecutivo. Pide provenance explícita en cifras críticas.
  - **Chip ChatInput**: cuando ambos están presentes muestra `"A vs B"` con los dos nombres en lugar del chip individual.
  - **Render switch**: orden `Comparativa lista (ambos Excel)` → `FileReadyView con onStartComparison` → mensajes normales.
- Archivos: `src/components/chat/cards/FileReadyView.tsx`, `src/components/chat/cards/ComparisonReadyView.tsx` (nuevo), `src/app/dashboard/chat/page.tsx`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (8 tests).
- Pendiente: extender a PDF-vs-PDF y DXF-vs-DXF si surge demanda (hoy A y B deben ser Excel para mantener fidelidad numérica). El UX intencional restringe el segundo archivo a Excel desde el `accept=` del input para evitar confusión.

## 2026-05-16 - Claude - Alertas de proactividad surface en UI (roadmap §1.3)

- Objetivo: cerrar la parte pendiente de "Motor de proactividad" del ROADMAP §1.3 surfacéando en la UI los hallazgos que `runDailyProjectScan()` ya está dejando en `audit_log_events`. Activar el schedule InsForge contra URL pública queda fuera de scope (requiere deploy).
- Cambios:
  - **API**: nuevo `GET /api/proactivity/findings` (con `requireAuth` + rate limit estándar) lee `audit_log_events` filtrando por `organization_id`, `event_type='project.proactivity_scan'` y opcional `?projectId=`. Toma sólo el último evento de cada obra (los anteriores quedan en el log inmutable pero no se devuelven), suma severidades, ordena por `critical` desc / `warning` desc y devuelve `{ hasData, latestScanAt, projectsScanned, findingsCount, bySeverity, projects[] }`. Schema validado con `proactivityFindingsResponseSchema`.
  - **Hook**: `useProactivityFindings({ projectId?, enabled? })` con React Query, `staleTime: 60s` y queryKey `["proactivity-findings", projectId ?? "all"]`. Reusa `getAuthHeaders` y Zod parsing del response.
  - **UI**: `ProactivityAlertsBanner` (en `src/components/chat/`) muestra banner colapsable arriba del chat. Por defecto se oculta cuando solo hay severidad `info`. Tono visual (rojo/naranja/neutral) según severidad agregada, header con conteo "X críticos · Y advertencias" y fecha del último escaneo. Expandido lista hasta 4 hallazgos top por obra ordenados por severidad. Integrado en `dashboard/chat/page.tsx` justo después del banner de índices, filtrando por `activeProject?.id ?? null` (si no hay obra activa, muestra hallazgos consolidados de todas las obras de la org).
- Archivos: `src/app/api/proactivity/findings/route.ts` (nuevo), `src/lib/validators/api-responses.ts`, `src/hooks/useProactivityFindings.ts` (nuevo), `src/components/chat/ProactivityAlertsBanner.tsx` (nuevo), `src/app/dashboard/chat/page.tsx`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (8 tests).
- Pendiente: schedule InsForge contra URL pública (requiere deploy con `NEXT_PUBLIC_APP_URL` real y `CRON_SECRET`). Una vez activo, las cards se rellenan solas; mientras tanto, se pueden generar hallazgos haciendo `POST /api/cron/project-proactivity` con el `CRON_SECRET` y se reflejan en la UI tras ≤60s (staleTime del hook). El audit log inmutable conserva el histórico completo aunque la UI solo muestre el último.

## 2026-05-16 - Claude - Tools de gestión integral de obra (roadmap §1.3)

- Objetivo: cerrar el bloque 🔥 M de "tools nuevas para el agente" del ROADMAP §1.3 apoyándose en la arquitectura de datos extendida.
- Cambios:
  - Helpers nuevos en `src/lib/project-operations/`:
    - `personnel.ts` → `verifyPersonnelClearance({ cuadrilla, projectId, organizationId })` lee `project_hse_records`, hace match por subject/worker/subcontractor, calcula veredicto (`apto` / `observado` / `no_apto` / `sin_registro`) según bloqueantes (`expired`, `missing`, `incident`), tipos faltantes obligatorios (ART/EPP) y vencimientos ≤14 días.
    - `schedule.ts` → `reprogramAndInform({ taskRef, newDueDate, reason?, notifyTo? })` resuelve la tarea por UUID/código/nombre (con detección de ambigüedad), actualiza `due_date` + `status` en `project_schedule_tasks` y deja evento `schedule.rescheduled` en `audit_log_events` con `previousDueDate`, `previousStatus`, `notifyTo` y `reason`.
    - `financial-curve.ts` → `auditInvestmentCurve({ projectId, limit? })` arma puntos de curva S desde `project_financial_snapshots`, calcula desvío último vs plan, ratios `actual/planned` y `committed/planned`, detecta duplicados de fecha y produce veredicto (`alineado` / `observado` / `desviado_critico`).
  - Tools registradas en `agentTools` (con `organizationId` en schema, fuente de verdad documental) y en `createBoundTools(orgId)` (sin `organizationId`, orgId server-verified). El binding sigue el patrón anti-prompt-injection de A-04.
  - Prompt actualizado: la sección "Gestión Integral" pasó de 3 a 5 puntos. Cada nueva tool tiene reglas de uso (cuándo invocarla, qué hacer con `sin_registro`/`ambiguous_task`/`desviado_critico`).
  - Labels en `MessageBubble.tsx` para que la UI muestre "Verificando legajo HSE de la cuadrilla", "Reprogramando tarea y registrando evento", "Auditando curva S vs plan".
- Archivos: `src/lib/project-operations/personnel.ts` (nuevo), `src/lib/project-operations/schedule.ts` (nuevo), `src/lib/project-operations/financial-curve.ts` (nuevo), `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `ROADMAP.md`, `docs/AI_WORKLOG.md`.
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (8 tests, suites previas siguen verdes).
- Pendiente: tests integrales contra DB real para las 3 tools (hoy solo cubre que compilan y el prompt está alineado). `notifyTo` queda registrado en el audit_log pero no dispara emails — cuando se conecte Resend a alertas operativas, leerlo desde `audit_log_events` filtrando `event_type='schedule.rescheduled'`.

## 2026-05-17 - Codex - Dashboard Día en la obra

- Objetivo: completar el espejo UI del `resumen_diario_obra` pendiente en roadmap §2.4.
- Cambios: agregado endpoint autenticado `GET /api/projects/[id]/daily-brief`, hook `useDailyProjectBrief()` y página `/dashboard/obras/[id]/today` con cronograma, HSE, acopios, curva S, alertas de proactividad, clima y CTA "Auditar lo nuevo". `buildDailyBrief()` ahora usa la ubicación de la obra como fallback para clima. El detalle de obra enlaza a la nueva vista.
- Archivos: `src/app/api/projects/[id]/daily-brief/route.ts`, `src/hooks/useDailyProjectBrief.ts`, `src/app/dashboard/obras/[id]/today/page.tsx`, `src/app/dashboard/obras/[id]/page.tsx`, `src/lib/project-operations/daily-brief.ts`, `src/lib/validators/api-responses.ts`, `docs/04_architecture_map.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (27/27); `curl -I /dashboard/obras/test/today` redirige a login por proxy; `curl -I /api/projects/test/daily-brief` devuelve 401 sin auth.
- Pendiente: QA visual autenticado con una obra que tenga datos operativos reales; el schedule InsForge público de proactividad sigue pendiente de deploy/URL pública.

## 2026-05-17 - Codex - Super Admin visual + tools de subcontratos

- Objetivo: mejorar visualmente `/super-admin` completo y cerrar el pendiente local de tools de subcontratos del roadmap §1.3.
- Cambios: rediseñada la pantalla de acceso Super Admin con layout editorial técnico, fondo blueprint, señales operativas y card de acceso más consistente. El panel autenticado ahora usa header, tabs, métricas, cards y filas más densas/responsivas. Agregado `subcontracts.ts` con `registerSubcontract()` y `auditSubcontracts()`, tools `registrar_subcontrato` / `auditar_subcontratos`, labels UI y prompt operativo.
- Archivos: `src/app/super-admin/page.tsx`, `src/lib/project-operations/subcontracts.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-tools-bound.ts`, `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `docs/04_architecture_map.md`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (27/27); `curl -I /super-admin` responde 200.
- Pendiente: QA visual autenticado real en `/super-admin` con `SUPER_ADMIN_KEY`; tests integrales de subcontratos contra DB de staging.

## 2026-05-17 - Codex - Super Admin sobrio + confidence visible

- Objetivo: corregir el login/estadísticas de Super Admin y cerrar el pendiente de confidence visible del roadmap §2.4.
- Cambios: login `/super-admin` reemplazado por consola compacta de uso privado, sin hero vacío. Estadísticas rehechas como dashboard operativo con KPIs sobrios, capacidad agregada, ranking de storage, distribución comercial y tabla de salud por tenant. `FindingCallout` ahora muestra badge/barra de confidence 0-100; `proyectar_metricas` acepta confidence en KPIs/barras y lo renderiza.
- Archivos: `src/app/super-admin/page.tsx`, `src/components/chat/cards/FindingCallout.tsx`, `src/components/chat/blocks/MetricsBlock.tsx`, `src/lib/validators/blocks.ts`, `src/lib/ai/agent-tools.ts`, `src/lib/ai/agent-prompt.ts`, `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (27/27); `curl -I /super-admin` responde 200.
- Pendiente: QA visual autenticado real en `/super-admin` con datos de producción/staging.

## 2026-05-17 - Claude - Tools de generación + email stakeholders (roadmap §1.3)

- Objetivo: cerrar el último ítem 🟡 M abierto de §1.3 con las 3 tools de generación faltantes para completar la capa operativa del PM Digital.
- Cambios:
  - **`generar_orden_compra`** (tool + `/api/generate/orden-compra` + `generateOrdenCompraBuffer`): arma OC en .docx con header de obra, datos de proveedor (nombre, contacto, email, teléfono), tabla de items con totales por línea, totales (subtotal, IVA %, total), bloque de condiciones (lugar de entrega, fecha, forma de pago, notas) y firma. Acepta `supplyItemId` opcional para trazabilidad al acopio. Devuelve `doc_generation_proposal` con `docType: "orden_compra"` para que `GeneratedDocCard` lo renderice.
  - **`generar_acta_obra`** (tool + `/api/generate/acta-obra` + `generateActaObraBuffer`): genera parte diario en .docx con secciones para clima, cuadrilla (rol/nombre/subcontratista/conteo), tareas ejecutadas (descripción + avance + observaciones), materiales recibidos, incidentes HSE (con severidad leve/moderado/critico color-coded), visitas en obra y notas. Header con fecha formateada a es-AR. Firma del capataz.
  - **`enviar_email_stakeholder`** (tool + `src/lib/project-operations/notifications.ts`): envía emails vía Resend con whitelist estricta por proyecto. Whitelist = emails de contactos de subcontratos no eliminados (`project_subcontracts.contact_email`). Validaciones: máx 5 destinatarios totales (to+cc), asunto 3-160 chars, body 10-5000 chars. Casos de rechazo cubiertos: `missing_recipients`, `too_many_recipients`, `invalid_subject`, `invalid_body`, `empty_whitelist`, `whitelist_blocked`, `no_api_key`, `send_failed`, `send_exception`. Cada caso registra evento en audit log (`email.stakeholder_sent` / `_dry_run` / `_failed`). Template HTML sobrio con header EdificIA y cuerpo con párrafos formateados.
  - **`createBoundTools(orgId, actorUserId?)`**: extendido para inyectar `actorUserId` server-verified en el tool de email (para audit log). El chat route pasa `auth.userId`.
  - **UI**: `GeneratedDocCard.DOC_CONFIG` ahora soporta `orden_compra` (icon `FileSignature`, ocre) y `acta_obra` (icon `ClipboardList`, teal). `DocGenerationProposal.docType` extendido con los dos nuevos valores. `MessageBubble` labels: "Armando orden de compra", "Generando parte diario de obra", "Enviando email a stakeholders".
  - **Prompt**: "Generación de documentos" lista las 2 tools nuevas con reglas (no inventar precios/cantidades, pedir datos faltantes). Nueva sección "Comunicación con stakeholders" explica: 1) pedir confirmación explícita antes de enviar, 2) qué hacer ante cada `reason` de rechazo, 3) máx 5 destinatarios, 4) no incluir PII salvo pedido explícito.
  - **Tests**: `tests/docx-generators.test.mjs` con 6 casos: OC con datos mínimos / OC completa con IVA / cálculo automático de totales; acta mínima / acta completa con todos los campos / formateo de fecha. Verifica que cada buffer empiece con el magic header ZIP (0x50 0x4B) y supere los 5KB cuando lleva contenido. Total: 35 tests (+8 desde la corrida anterior).
- Archivos:
  - `src/lib/export/generate-docx.ts` (+`generateOrdenCompraBuffer`, +`generateActaObraBuffer`, +tipos `OrdenCompraData`, `ActaObraData` y sub-tipos)
  - `src/app/api/generate/orden-compra/route.ts` (nuevo)
  - `src/app/api/generate/acta-obra/route.ts` (nuevo)
  - `src/lib/project-operations/notifications.ts` (nuevo)
  - `src/lib/ai/agent-tools.ts` (+3 tools)
  - `src/lib/ai/agent-tools-bound.ts` (+3 bound tools, signature extendida con actorUserId)
  - `src/lib/ai/agent-prompt.ts` (+sección stakeholders, +reglas de generación)
  - `src/components/chat/cards/GeneratedDocCard.tsx` (+2 docTypes en DOC_CONFIG)
  - `src/components/chat/MessageBubble.tsx` (+3 labels, +2 SPECIAL_TOOLS)
  - `src/app/api/chat/route.ts` (pasa userId a createBoundTools)
  - `tests/docx-generators.test.mjs` (nuevo)
  - `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (35/35, +8 desde corrida previa).
- Pendiente: validar contra una org con subcontratos reales que la whitelist filtra correctamente (hoy solo cubierto a nivel de unit test indirecto). El envío real de emails requiere `RESEND_API_KEY` y un `RESEND_FROM_EMAIL` con dominio verificado en Resend; sin estos vars el tool devuelve `reason: "no_api_key"` y queda el dry-run en audit log. Para tests E2E con descarga, abrir el chat con una obra activa, pedir "armá la OC a X por Y kg de hierro a $Z" y validar que el `GeneratedDocCard` descarga el .docx correctamente.

## 2026-05-17 - Claude - Hypothesis branching + retry strategy + tool telemetry (roadmap §2.1)

- Objetivo: cerrar el bloque de tres ítems 🟡 M de §2.1 sobre inteligencia agéntica observable y estructurada.
- Cambios:
  - **Hypothesis branching** (`src/lib/ai/hypothesis-parser.ts` + `src/components/chat/cards/HypothesisBlock.tsx`): parser puro `extractHypothesis(text)` extrae `<hypothesis>{branches:[...],chosen?,rationale?}</hypothesis>` con manejo de streaming (oculta JSON parcial mientras la etiqueta no cerró). Validación estricta: cada rama requiere `name`, `confidence` numérico, `evidence`. UI render con ramas ordenadas por confianza desc, badge "elegida" en la rama seleccionada, barra de progreso por confianza, rationale al pie. Integrado en `MessageBubble.TextPart` antes del bloque de plan (la hipótesis precede al plan cuando se emiten ambos).
  - **Retry strategy estructurada** (`agent-prompt.ts`): nueva sección "Retry estructurado cuando una tool falla" con patrón en 5 pasos: leer error → ajustar inputs → reintentar UNA vez → declarar límite → no loop con mismos inputs. Lista explícita de casos donde NO reintentar (whitelist_blocked, empty_whitelist, sin_registro, ambiguous_task, no_api_key) y manda surfacear al usuario en su lugar.
  - **Tool telemetry** (`src/lib/ai/tool-telemetry.ts`): `summarizeToolUsage(steps)` agrega por tool `{ calls, errors, retries }` desde el array de steps de AI SDK. Detección de errores conservadora: `ok:false`, `error:true`, `error:"..."` non-empty. Retries derivados de "tool llamada ≥2 veces con ≥1 error previo" (capped a `errors`). `toTelemetryRows()` devuelve filas ordenadas por calls desc para queries fáciles. `/api/chat` ahora persiste `toolTelemetry`, `toolCallsTotal`, `toolErrorsTotal`, `toolRetriesTotal` en `audit_log_events.payload`. Severity del evento `chat.completed` escala a `warning` si hubo ≥1 error en el turno — esto hace queryable las sesiones con tools rotas.
  - **Prompt — sección hypothesis**: define cuándo usarlo (ambigüedad documental real, no plan B mecánico), formato JSON minificado, 2-4 ramas, confidence decimal 0-1, evidencia obligatoria, `chosen` opcional. Prohíbe usar hipótesis para encubrir falta de información.
  - **Tests**: `tests/tool-telemetry.test.mjs` (6 casos: empty steps, count calls, detect errors, retries con error previo, no retries sin errors, sort por calls). `tests/hypothesis-block.test.mjs` (7 casos: bloque completo, streaming pending, sin bloque, JSON malformado, branches vacías, branches sin campos requeridos, omitir chosen/rationale).
- Archivos:
  - `src/lib/ai/tool-telemetry.ts` (nuevo)
  - `src/lib/ai/hypothesis-parser.ts` (nuevo, separado de la UI para que el loader de tests sin .tsx pueda importarlo)
  - `src/components/chat/cards/HypothesisBlock.tsx` (nuevo, re-exporta el parser)
  - `src/components/chat/MessageBubble.tsx` (integra `HypothesisBlock` antes del `PlanBlock`)
  - `src/lib/ai/agent-prompt.ts` (+sección "Hipótesis con ramas", +sección "Retry estructurado cuando una tool falla")
  - `src/app/api/chat/route.ts` (wire de `summarizeToolUsage` + `toTelemetryRows` en `onFinish`, severity escalada por errores)
  - `tests/tool-telemetry.test.mjs` (nuevo)
  - `tests/hypothesis-block.test.mjs` (nuevo)
  - `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm run lint` OK; `npm test` OK (50/50, +15 desde corrida previa: 6 telemetry + 7 hypothesis +2 docx no contados antes de re-run completo). Notar que las suites `excel-parser` y `docx-generators` quedaron skipped por shape del runner pero sus tests individuales suman.
- Pendiente: validar empíricamente que DeepSeek respete el contrato de `<hypothesis>` en obras reales (igual que pasó con `<plan>` en su momento). Si el modelo lo ignora, considerar pasarlo a structured-output secundario. Para retry strategy, observar si el agente realmente se limita a 1 reintento — el prompt es deterministic pero el modelo decide. Tool telemetry queda escrito en `audit_log_events.payload`; falta UI de exploración (queryable por tool, periodo, error rate) — eso vive en el ítem "Replay de auditoría" §2.4 pendiente.

## 2026-05-17 - Codex - Agent Core plan + primer hardening

- Objetivo: dejar documentado el rediseño pragmático del agente y empezar por un bloque incremental sin romper comportamiento.
- Cambios: agregado `docs/08_agent_core_redesign.md` con modelo Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos, separación de responsabilidades, entidades recomendadas, agrupación futura de capacidades y plan de migración por fases. `/api/upload` y `/api/sessions` ahora validan que el `projectId` recibido desde cliente exista en la `organization_id` autenticada antes de persistir. `MessageBubble` ahora renderiza `generar_orden_compra` y `generar_acta_obra` con `GeneratedDocCard`; el ajuste de documentos reconoce esos docTypes. Agregado skeleton no invasivo de `src/lib/agent-core/` con tipos de scope/caso/capacidad, registry conceptual, builder puro de scope y composición inicial de prompt modules.
- Archivos: `docs/08_agent_core_redesign.md`, `docs/README.md`, `docs/04_architecture_map.md`, `src/app/api/upload/route.ts`, `src/app/api/sessions/route.ts`, `src/components/chat/MessageBubble.tsx`, `src/app/dashboard/chat/page.tsx`, `src/lib/agent-core/*`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm test` OK (50/50).
- Pendiente: siguiente bloque recomendado: empezar a usar `agent-core` en `/api/chat` solo para construir scope/contexto, sin cambiar tools ni prompt efectivo; después diseñar migración de `chat_sessions` hacia expedientes operativos.

## 2026-05-17 - Codex - Agent Core wiring no invasivo

- Objetivo: empezar a usar `src/lib/agent-core/` sin modificar comportamiento del agente.
- Cambios: `/api/chat` ahora construye `agentCoreScope` con `buildAgentCoreScope()` luego de validar la obra activa y deriva `capabilityIds` con `getCapabilitiesForScope()`. Esa metadata se registra en logs y en `audit_log_events.payload.agentCore`, pero el prompt efectivo y el set de tools no cambian. Agregados tests puros de scope, capacidades y prompt modules.
- Archivos: `src/app/api/chat/route.ts`, `tests/agent-core.test.mjs`, `docs/08_agent_core_redesign.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58).
- Pendiente: diseñar y aplicar migración inicial `work_cases` / `work_case_events` / `work_case_evidence`; luego asociar nuevas sesiones a expediente.

## 2026-05-17 - Codex - Roadmap alineado a Agent Core

- Objetivo: revisar si los pendientes del roadmap ayudan al rediseño actual del agente y ajustar el orden de trabajo.
- Cambios: `ROADMAP.md` ahora declara como foco vigente Agent Core + Expedientes Operativos. Agregada sección §2.6 con estado completado del plan, hardening de `projectId`, skeleton `agent-core`, wiring audit-only y próximos pendientes (`work_cases`, `work_case_events`, `work_case_evidence`, `operational_findings`, UI de expedientes, migración legacy y modularización prompt/tools). La recomendación semanal se reemplazó por el orden del rediseño. Proactividad se mantiene, pero reordenada: antes de activar schedule público conviene separar `operational_findings` de `audit_log_events`.
- Archivos: `ROADMAP.md`, `docs/AI_WORKLOG.md`
- Verificacion: no ejecutada; cambio documental.
- Pendiente: implementar la migración inicial de expedientes operativos y actualizar `docs/04_architecture_map.md` cuando existan las tablas/rutas reales.

## 2026-05-17 - Codex - Organización por dominios sin cambio de comportamiento

- Objetivo: reducir archivos sueltos y aclarar ownership alrededor del agente, operaciones de obra y tests, sin tocar rutas de Next ni lógica de negocio.
- Cambios: movidos helpers nuevos del agente a `src/lib/ai/output/` y `src/lib/ai/observability/`; movidos helpers recientes de operaciones a `src/lib/project-operations/brief/`, `communications/`, `contracts/`, `supplies/` y `agent-writers/`; agrupados tests en `tests/agent/`, `tests/chat/`, `tests/documents/`, `tests/math/` y `tests/project-operations/`. Imports actualizados. `docs/04_architecture_map.md` refleja la estructura real.
- Archivos: `src/lib/ai/output/hypothesis-parser.ts`, `src/lib/ai/observability/tool-telemetry.ts`, `src/lib/project-operations/brief/daily-brief.ts`, `src/lib/project-operations/communications/stakeholder-email.ts`, `src/lib/project-operations/contracts/subcontracts.ts`, `src/lib/project-operations/supplies/supply-status.ts`, `src/lib/project-operations/agent-writers/operational-writers.ts`, `tests/*/*.test.mjs`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `npm run type-check` OK; `npm test` OK (58/58).
- Pendiente: no mover todavía `agent-tools.ts`, `agent-tools-bound.ts`, `agent-prompt.ts`, `MessageBubble.tsx`, `components/chat/blocks` ni rutas `src/app/*`; esos renames tienen más riesgo y conviene hacerlos cuando Agent Core tenga expedientes y tests de integración.

## 2026-05-17 - Codex - Limpieza visual de raíz en VS Code

- Objetivo: ordenar la vista del proyecto sin mover archivos que Next/npm/Docker/TypeScript esperan en la raíz.
- Cambios: agregado `.vscode/settings.json` con file nesting para agrupar configs bajo `package.json`, `next.config.ts`, `README.md`, `docker-compose.yml` y `.env.local`; ocultados del Explorer artefactos locales/generados como `node_modules`, `.next`, `.claude-flow`, `.insforge`, `tsconfig.tsbuildinfo` y `next-env.d.ts`.
- Archivos: `.vscode/settings.json`, `docs/AI_WORKLOG.md`
- Verificacion: JSON parse OK.
- Pendiente: si se quiere una limpieza física real, evaluar en una rama separada mover Docker a `infra/docker/` y scripts a subcarpetas, actualizando comandos/documentación. No hacerlo mezclado con el refactor del agente.

## 2026-05-17 - Codex - Handoff a Claude para migración Agent Core

- Objetivo: dejar preparado el traspaso para continuar con la migración incremental hacia Expedientes Operativos.
- Estado: `docs/08_agent_core_redesign.md` documenta el modelo objetivo; `ROADMAP.md` §2.6 y §3 priorizan la migración inicial; `/api/chat` ya persiste `audit_log_events.payload.agentCore` con scope/capabilities sin cambiar comportamiento; `src/lib/agent-core/` existe como skeleton; la estructura reciente quedó organizada por dominios.
- Verificacion reciente: `npm run type-check` OK; `npm test` OK (58/58). Después solo se agregó `.vscode/settings.json` y esta entrada de handoff.
- Siguiente bloque recomendado: crear migración InsForge en `migrations/` para `work_cases`, `work_case_events` y `work_case_evidence`, con RLS estricto por `organization_id`, sin tocar todavía UI ni prompt. Luego actualizar `docs/04_architecture_map.md`, `ROADMAP.md` y este worklog.
- Riesgos/guardrails: no confiar en IDs cliente; toda API privada futura debe usar `requireAuth(req)`; no usar `audit_log_events` como read model de estado vivo; no mover `agent-tools.ts`, `agent-tools-bound.ts` ni `agent-prompt.ts` en el mismo bloque.

## 2026-05-17 - Codex - Repo principal migrado a EdificiA-Core

- Objetivo: dejar el repo nuevo como remoto principal antes de borrar el anterior.
- Cambios: `origin` apunta a `https://github.com/nachapoticon-dot/EdificiA-Core.git`; `main` trackea `origin/main`; README actualizado para clonar `EdificiA-Core`.
- Archivos: `README.md`, `docs/AI_WORKLOG.md`
- Verificacion: `git remote -v` apunta a `EdificiA-Core`; búsqueda de referencias al repo viejo sin resultados activos.
- Pendiente: borrar el repositorio anterior desde GitHub cuando confirmes que `EdificiA-Core` quedó completo.
