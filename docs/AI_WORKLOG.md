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
