# Roadmap — EdificIA

> Estado consolidado al **2026-05-20**.
> Este documento reemplaza los antiguos `docs/planning/*.md` (todos archivados).
>
> Convención de prioridad: 🔥 alto impacto · 🟡 medio · 🟢 nice-to-have
> Convención de esfuerzo: **S** = < 1 h · **M** = medio día · **L** = ≥ 1 día
>
> Foco vigente desde 2026-05-17: **Agent Core + Expedientes Operativos**. La prioridad de producto es que EdificIA deje de orbitar alrededor de sesiones de chat y se organice como `Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos`. Ver `docs/08_agent_core_redesign.md`.

---

## -1 · Desconexión de infraestructura externa (completada 2026-06-11)

EdificIA ya **no depende de InsForge ni de Qdrant**. Ejecutado en 7 fases (rama `feat/desconexion-insforge-qdrant`, un commit por fase):

- ✅ **Fase 0** — Postgres local autosuficiente: runner de migraciones propio (`scripts/migrate.mjs`, tabla `schema_migrations`), bootstrap (extensiones pgvector/pgcrypto/citext, roles shim, `auth.uid()`, `auth.users`) y baseline consolidado de las migraciones legacy. Imagen `pgvector/pgvector:pg16` en compose.
- ✅ **Fase 1** — Capa de datos propia: `src/lib/db/` con query-builder compatible con la interfaz del SDK (`.from().select().eq()` → `{data,error,count}`, nunca lanza) sobre `pg`; los ~94 call-sites no se tocaron. Storage filesystem con adapter (`src/lib/storage/fs-adapter.ts`).
- ✅ **Fase 2** — Auth propia: `auth.users` + bcryptjs + JWT HS256 local (`jose`, `AUTH_JWT_SECRET`) + `auth.refresh_tokens` con rotación; rutas auth reescritas + nueva `/api/auth/refresh`. Nota: al intentar el export, el proyecto InsForge cloud respondía HTTP 503 ("No backend services available") — cutover con base limpia; scripts `export-insforge.mjs`/`import-local.mjs` quedan como referencia.
- ✅ **Fase 3** — pgvector reemplaza Qdrant: `document_chunks.embedding vector(1024)` + HNSW; búsqueda semántica por SQL con los mismos umbrales; fix de timeout en embeddings NVIDIA.
- ✅ **Fase 4** — Limpieza final: sin `@insforge/sdk` ni `@qdrant/js-client-rest`; `AUTH_STRICT_MODE` eliminado (la verificación local es siempre estricta); `.insforge/` removido del repo.
- ✅ **Fase 5** — **Agente Python (cerebro)**: `services/agent/` (FastAPI) orquesta los turnos (loop LLM→tools, router de modelos, streaming UI Message Stream v1) detrás de `AGENT_BACKEND=python`; las tools TS se ejecutan vía tool gateway `/api/internal/tools/*` (`AGENT_GATEWAY_SECRET`). Rollback instantáneo quitando el flag.
- ✅ **Fase 6** — **Aprendizaje real**: `agent_memories` (embedding + scope + confianza) y `agent_feedback`; reflexión LLM post-turno destila aprendizajes durables; feedback negativo con corrección → memoria de alta confianza; retrieval semántico inyecta memoria al prompt con refuerzo por uso y decaimiento temporal. Reemplaza el rol de `session-learner`/heurísticas como mecanismo de aprendizaje.

Pendientes derivados: migrar tools de a una al servicio Python; deprecar `company_learned_patterns` cuando `agent_memories` cubra sus usos; UI de feedback más rica (rating positivo y corrección inline); mover el servicio a la infraestructura definitiva cuando se elija.

---

## 0 · Pendientes externos (fuera de alcance actual)

Estos puntos están **fuera de alcance hasta resolver dependencias externas**. No son trabajo de código pendiente dentro del repo: requieren infraestructura, credenciales o decisiones del cliente. No prometer fechas ni darlos por hechos.

- **URL pública + schedule automático.** El motor de proactividad y su read model ya están listos, pero el schedule diario de InsForge no se puede registrar sin una URL pública estable (`NEXT_PUBLIC_APP_URL` apunta a localhost) ni `CRON_SECRET`. No se registra automáticamente hasta que el usuario lo pida.
- **Conectores reales read-only (Drive / SharePoint / OneDrive / SQL / ERPs).** La arquitectura, el registro de fuentes y los estados de preparación ya existen (Etapa 2 base), pero los conectores reales requieren OAuth + credenciales del cliente + dependencias de conector. Ver `docs/06_enterprise_context_layer.md` Etapa 2.
- **Credenciales / secret management para fuentes externas.** Cifrado y rotación de secrets por conector; depende del punto anterior.

---

## 1 · Pendientes heredados de docs/planning

### 1.1 · Infra / observabilidad

- ✅ 2026-05-19 — **Sistema de alertas equivalente a Sentry (local)**. Migración `20260519033600_app-error-events.sql` crea `app_error_events` con RLS. `captureAppError()` registra fallas críticas/operativas en `/api/chat`, cron de proactividad, contexto empresarial, findings, upload y reindex. `GET/PATCH /api/admin/error-events` + `/dashboard/admin/errors` permiten ver y resolver alertas por organización.
- ✅ 2026-05-16 — WAL verification en PostgreSQL para self-hosted.
- 🟢 **M** — Estrategia de rollback automatizada (snapshot pre-deploy).
- 🟢 **L** — Performance profiling bajo carga real (cuando haya tráfico).

### 1.2 · Auth / roles

- 🟡 **M** — Rol "external auditor" con links de vista temporal (expiry).

### 1.3 · Dominio de obra (Gestión Integral)

Lo que falta del **plan original "Project Manager Digital"**:

- ✅ 2026-05-16 — **Arquitectura de datos extendida**. Agregadas tablas InsForge/PostgreSQL con RLS para cronograma (`project_schedule_tasks`), finanzas/curva S (`project_financial_snapshots`), subcontratos (`project_subcontracts`), HSE (`project_hse_records`) y acopios/suministros (`project_supply_items`). También se corrigió `projects.status` para usar los estados reales de la UI.
- ✅ 2026-05-19 — **Motor de proactividad (motor + read model listos)**. `runDailyProjectScan()` + `/api/cron/project-proactivity` detectan riesgos de cronograma, HSE, suministros, curva S y documentación stale. Los hallazgos vivos se persisten en `operational_findings`; `audit_log_events` queda como evidencia inmutable/resumen append-only. UI: `GET /api/proactivity/findings` + `useProactivityFindings()` + `ProactivityAlertsBanner` leen desde el read model vivo (filtrado opcional por obra activa). **El schedule diario automático queda como pendiente externo** (requiere URL pública estable; ver §0).
- ✅ 2026-05-16 — **Integración meteorológica real**. Nueva tool `evaluar_impacto_clima` consulta Open-Meteo (geocoding + forecast diario) y traduce lluvia/viento/temperatura a riesgo operativo para obra.
- ✅ 2026-05-16 — **Tools nuevas para el agente**: `verificar_ingreso_personal` lee `project_hse_records` y devuelve veredicto (apto / observado / no_apto / sin_registro). `reprogramar_e_informar` actualiza `project_schedule_tasks` y registra `schedule.rescheduled` en el audit log. `auditar_curva_inversion` arma la curva S desde `project_financial_snapshots` y reporta desvío.
- ✅ 2026-05-17 — **Tools writer del agente (5)**: `registrar_snapshot_financiero` escribe a `project_financial_snapshots` (upsert por fecha). `registrar_hse_record` crea legajos HSE con cálculo automático de status desde `expiresAt`. `registrar_acopio` (modo create/update) maneja `project_supply_items` con status inferido. `resolver_relacion_documental` cierra contradicciones del knowledge graph (confirm/dismiss/supersede). `resumen_diario_obra` agrega cronograma+HSE+acopios+financiero+alertas+clima opcional en un solo llamado.
- ✅ 2026-05-17 — **Tools de generación faltantes**: `generar_orden_compra` arma OC en .docx con vendor, items, IVA y condiciones (acepta `supplyItemId` opcional para trazabilidad). `generar_acta_obra` produce parte diario en .docx (clima, cuadrilla, tareas con avance, incidentes HSE, materiales recibidos, visitas). `enviar_email_stakeholder` envía vía Resend con whitelist estricta por proyecto (solo emails registrados en `project_subcontracts.contact_email`); rechaza fuera de whitelist y registra `email.stakeholder_sent` / `email.stakeholder_dry_run` / `email.stakeholder_failed` en audit log.
- ✅ 2026-05-17 — **Tools de subcontratos**: `registrar_subcontrato` crea rows en `project_subcontracts` y registra `subcontract.registered` en audit log. `auditar_subcontratos` calcula incidencia por rubro, montos activos, vencimientos contractuales y retenciones acumuladas estimadas.

---

## 2 · Mejoras estratégicas (propuestas Opus, 2026-05-16)

### 2.1 · Inteligencia del agente (lo que más cambia el producto)

- ✅ 2026-05-16 — **Lectura agéntica de documentos**. Prompt y UX migrados a ciclo de clasificación, hipótesis, extracción, contraste, verificación y síntesis.
- ✅ 2026-05-16 — **Plan-then-execute**. El agente emite bloque `<plan>` antes de usar múltiples tools y la UI lo renderiza como plan de auditoría.
- ✅ 2026-05-16 — **Self-critique pre-respuesta**. Checklist de auto-verificación incorporada al prompt antes del cierre.
- ✅ 2026-05-16 — **Router de modelos**. `routeModel(messages)` clasifica por señales (archivo adjunto, A vs B, contradicciones, cross-doc, turno largo, hints explícitos) y devuelve tier `fast` o `deep`. Modelos via `AI_MODEL_FAST` / `AI_MODEL_DEEP` env vars (caen al `AI_MODEL` actual —DeepSeek— si no se setean; listos para apuntar a otro proveedor de razonamiento "deep" cuando se agregue su API key). El audit log registra `tier`, `model` y `routeReason` por turno.
- ✅ 2026-05-17 — **Step budget tier-aware**. `stopWhen: stepCountIs(stepBudget)` ahora usa `stepBudget = tier === "deep" ? 35 : 20`. Persistido en audit log payload junto con `tier` y `routeReason`.
- ✅ 2026-05-17 — **Hypothesis branching**. Parser `extractHypothesis` en `src/lib/ai/hypothesis-parser.ts`, UI `HypothesisBlock` con ramas ordenadas por confianza, badge "elegida", barra de progreso por rama y rationale. Streaming-aware (oculta JSON parcial mientras el bloque no cerró). Prompt sección "Hipótesis con ramas" explica cuándo emitirlo (2-4 ramas, confianza decimal 0-1, evidencia obligatoria, `chosen` opcional para modo "pedir clarificación").
- ✅ 2026-05-17 — **Retry strategy estructurada**. Prompt sección "Retry estructurado cuando una tool falla" define patrón explícito: leer error → ajustar inputs → reintentar UNA vez → declarar límite. Lista casos donde NO reintentar (whitelist_blocked, ambiguous_task, sin_registro, no_api_key) y prohíbe loops de mismos inputs.
- ✅ 2026-05-17 — **Tool telemetry**. `summarizeToolUsage(steps)` en `src/lib/ai/tool-telemetry.ts` agrega per-tool `{ calls, errors, retries }` desde el array de steps del `onFinish`. `/api/chat` persiste `toolTelemetry` (filas ordenadas por calls desc) + totales en `audit_log_events.payload`. Severity del evento `chat.completed` escala a `warning` si hubo ≥1 error. Cobertura: 6 unit tests sobre conteo de calls, detección de errores (`ok:false`, `error:true`) y retries.
- ✅ 2026-05-19 — **Memoria activa escribible**. Tool bound `recordar_aprendizaje` escribe aprendizajes confirmados por usuario en `company_learned_patterns` bajo `document_type='agent_memory'`, con evidencia obligatoria, normalización de key/tags, auditoría `agent.memory_recorded` y scope server-side de org/usuario/obra/expediente. La migración `20260519170241_active-agent-memory.sql` expande el CHECK legacy para permitir `audit_history` y `agent_memory`.
- ✅ 2026-05-16 — **Memoria de usuario activa**. `recentSessions` ahora se usa proactivamente cuando coincide obra/tipo de archivo reciente.
- ✅ 2026-05-16 — **Confidence + provenance**. Cada cifra crítica del resumen debe llevar fuente documental y tool de cómputo.

### 2.2 · Profundidad de dominio

- ✅ 2026-05-19 — **Inteligencia Empresarial / sistema de indexación empresarial (slice 1)**. Migración `20260519032742_enterprise-context-slice.sql` crea `enterprise_sources`, `enterprise_documents` y `enterprise_sync_runs` con RLS y backfill desde `uploaded_files`. `/dashboard/contexto` concentra Radar, Fuentes y Mapa Vivo para que Base Documental no sea un bloque separado; `GET /api/enterprise-context/search` alimenta el radar de evidencia sobre documentos, obras, expedientes y relaciones del grafo. Pendiente estratégico futuro: conectores reales read-only (Drive/SharePoint/SQL/exports) y sync incremental.
- ✅ 2026-05-19 — **Perfil empresarial vivo (slice 2)**. Migración `20260519055500_enterprise-profile-slice.sql` agrega `enterprise_entities`, `enterprise_entity_aliases`, `enterprise_patterns`, `enterprise_project_coverage` y `enterprise_profile_snapshots` con RLS por organization. `src/lib/enterprise-context/profile-aggregator.ts` extrae entidades (proveedores, subcontratistas, rubros, ubicaciones, tipos documentales, monedas), patrones (naming convention, moneda dominante, frequent_supplier/subcontractor, trade_vocabulary, source_reliability, document_format) y cobertura por obra (score 0-1 + nivel de riesgo). `src/lib/enterprise-context/profile-builder.ts` orquesta lectura de `projects`/`project_subcontracts`/`project_supply_items`/`project_hse_records`/`project_schedule_tasks`/`project_financial_snapshots`/`enterprise_documents`/`document_intelligence_reports`/`operational_findings` y upsertea. `GET /api/enterprise-context/profile` (lectura) + `POST /api/enterprise-context/profile/refresh` (engineer+, dispara rebuild). Nueva pestaña `/dashboard/contexto/perfil` con resumen vivo, métricas, filtros por tipo de entidad, lista de patrones y tabla de cobertura con score + nivel de riesgo. Tests puros del aggregator en `tests/enterprise-context/profile-aggregator.test.mjs`.
- ✅ 2026-05-19 — **Registro de fuentes empresariales (Etapa 2 · slice base de conectores)**. La UI de Fuentes deja de ser fachada y lee del modelo real. `src/lib/enterprise-context/sources-service.ts` agrega `enterprise_documents` por fuente (conteos de readiness `descubierta→operativa/observada`) y resuelve el último `enterprise_sync_runs`. `GET /api/enterprise-context/sources` lista fuentes con estado de preparación y último sync; `POST` (engineer+) declara fuentes externas read-only en estado `discovered` con scopes/carpetas permitidas (bloquea `manual_upload`); `PATCH /api/enterprise-context/sources/[id]` (engineer+) renombra/pausa/reactiva/revoca; `GET /api/enterprise-context/sources/[id]/documents` devuelve catálogo + sync runs. Nuevo `EnterpriseSourceRegistry` reemplaza los cards estáticos en `EnterpriseSourcesPanel`: lista fuentes, chips de readiness, acciones de gestión y catálogo expandible. Schemas en `api-responses.ts`. Pendiente Etapa 2: conectores reales (Drive/SharePoint OAuth, SQL driver) y sync incremental que poblen estas fuentes.
- ✅ 2026-05-20 — **Indexación estructural + convergencia de cargas manuales**. `ingestDocument()` sincroniza cada archivo subido con `enterprise_documents` bajo una fuente `manual_upload`, manteniendo readiness (`indexada`/`observada`/`inventariada`) alineado con `uploaded_files.indexing_status`. Nuevo extractor `src/lib/rag/structure.ts` detecta secciones jerárquicas en PDF/DOCX, rubros en Excel y capas en DXF; los chunks guardan `section_path`/`section_level` y el catálogo de Fuentes muestra si el documento tiene estructura, está plano o escaneado. Tests en `tests/rag/structure.test.mjs`. Pendiente estratégico futuro acotado: conectores externos reales con OAuth/SQL y sync incremental.
- ✅ 2026-05-19 — **Perfil empresarial integrado al agente**. `src/lib/enterprise-context/profile-reader.ts` expone `loadEnterpriseProfileForAgent(orgId)` (compact summary para prompt) y `queryEnterpriseProfileFacet(...)` (drill-down full por facet). `runtime.ts` pasa el top compacto a `buildSystemPrompt()` como `enterpriseProfile`, que renderiza una sección "Perfil de empresa (snapshot vN)" con moneda dominante, naming hints, top suppliers/subcontractors/trades y obras de riesgo alto/crítico. Nueva tool `consultar_perfil_empresa({ facet?: "summary"|"suppliers"|"subcontractors"|"trades"|"patterns"|"coverage" })` para que el agente profundice sin bloatear el prompt. Versión bound inyecta `organization_id` server-side. Cobertura en `tests/enterprise-context/prompt-integration.test.mjs`.
- ✅ 2026-05-16 — **Knowledge graph de obra (lectura)**. Migración `obra_relations` con tipos `contradicts/derives_from/supersedes/references/duplicates`, confianza 0-1, `detected_by` (system/agent/user), evidencia JSONB y RLS por org. Auto-populate desde `context-scan` cuando detecta contradicciones (system, dedupe por unique index parcial). Tool agente `buscar_relaciones_documento` resolve por `fileId` o `fileName`, filtra por tipo/proyecto y devuelve relaciones con dirección outgoing/incoming.
- ✅ 2026-05-17 — **Knowledge graph (resolución)**. Tool `resolver_relacion_documental` con acciones `confirm` / `dismiss` / `supersede` permite cerrar contradicciones detectadas automáticamente. `dismiss` soft-deletea con resolución registrada; `confirm` eleva confidence a 1 y marca `detected_by=user`; `supersede` crea relación nueva en sentido inverso y descarta la original.
- ✅ 2026-05-19 — **Knowledge graph (extensión semántica)**. Auto-populate best-effort desde `/api/upload`: `derives_from` cuando el documento nuevo cita nombres de documentos previos o task codes distintivos; `supersedes` cuando detecta versiones numéricas claras por filename (`V1`/`V2`, `rev 1`, etc.) y orienta la relación desde la versión más alta hacia la anterior.
- ✅ 2026-05-18 — **Knowledge graph (dump API para visualización)**. `GET /api/knowledge-graph` devuelve `{ meta, nodes, edges }` para que un visor externo (react-flow / Cytoscape / Gephi) renderice. Filtro opcional `?projectId`. La UI interna queda como opcional — la decisión es delegar visualización a herramienta de terceros.
- 🟢 **S** — **Knowledge graph (UI interna, opcional)**. Si más adelante queremos visor embebido en el dashboard, instalar react-flow y consumir el endpoint existente. Hoy delegado a tooling externo.
- ✅ 2026-05-16 — **Auto-detección de contradicciones al subir**. `upload` compara señales numéricas fuertes contra documentos previos de la misma obra/org (totales, montos explícitos, áreas DXF), advierte en UI y pasa `contextFindings` al agente.
- ✅ 2026-05-16 — **Cronograma real**. Parser CSV en `src/lib/schedule/csv-importer.ts` (sin deps nuevas, RFC4180-ish, headers en español/inglés). Endpoint `POST /api/projects/[id]/schedule/import` con modos `append`/`replace`, validación de fechas (YYYY-MM-DD y DD/MM/YYYY), resolución de predecesores por código, audit log `schedule.csv_import`. UI: `ScheduleImportSection` en `/dashboard/obras/[id]` con radio append/replace, ejemplo plegable y reporte de filas/warnings.

### 2.3 · Calidad de código

- ✅ 2026-05-16 — **Tests unitarios base**. Agregado `npm test` con `node:test`; cobertura inicial para `src/lib/math-engine/` y `src/lib/excel/parser`.
- ✅ 2026-05-16 — **Consolidar migrations**. `migrations/` queda como ruta canónica vía InsForge CLI; las raw SQL previas se archivaron en `docs/archive/db-migrations-legacy/` y Docker dejó de ejecutar migraciones al arrancar.
- ✅ 2026-05-16 — **Zod schemas para responses de API**. Responses JSON principales validadas con contrato compartido en `upload`, `auth/*`, `projects`, `sessions`, `documents`, `documents/save`, `indices`, `admin/*` y `super-admin/*`. Las rutas `generate/*` devuelven binarios (`xlsx`, `docx`, `pdf`), no JSON.
- ✅ 2026-05-16 — **Correlation IDs en logger**. `proxy.ts` genera/propaga `x-request-id` y `getRequestLogger()` vincula logs por request.
- ✅ 2026-05-16 — **Sub-organizar `src/components/chat/`**. Componentes divididos en `chat/sidebar/`, `chat/input/`, `chat/cards/` y raíz mínima.

### 2.4 · UX / Producto

- ✅ 2026-05-16 — **Onboarding forzado de índices**. El chat muestra un aviso operativo a admins cuando la org no tiene índices y enlaza directo a `Administración → Índices de Precio`.
- ✅ 2026-05-16 — **Side-by-side upload (A vs B)**. `FileReadyView` ofrece "Comparar con otra versión" cuando el archivo A es Excel; al subir B se renderiza `ComparisonReadyView` y el agente recibe un prompt dual con ambos cacheIds para correr `comparar_presupuestos`.
- ✅ 2026-05-17 — **Confidence visible al usuario**. `FindingCallout` muestra badge/barra 0–100 cuando la tool reporta `confidence`; `proyectar_metricas` acepta confidence en KPIs y barras y lo renderiza como badge/nota.
- ✅ 2026-05-19 — **"Por qué" expandible en hallazgos**. En la vista de expediente, cada hallazgo/riesgo documental abre un modal con evidencia principal, reporte documental, evidencia vinculada y telemetría de la ejecución de agente cuando existe. `GET /api/work-cases/[id]` devuelve `agentRuns[]` para alimentar la trazabilidad.
- ✅ 2026-05-19 — **Replay de auditoría**. La vista de expediente mezcla `agent_runs` y eventos: cada ejecución muestra modelo/tier, pasos, presupuesto, latencia, usage, tool telemetry, errores y reintentos, más payload técnico expandible. Los eventos del expediente siguen debajo como bitácora auditada.
- ✅ 2026-05-17 — **Día en la obra**. Dashboard `/dashboard/obras/[id]/today` con brief operativo de un día: cronograma vencido/bloqueado/próximo, HSE, acopios, curva S, alertas de proactividad, clima si hay ubicación y CTA "Auditar lo nuevo".
- ✅ 2026-05-20 — **Shadcn CLI + bloques operativos adaptados**. Se uso el CLI para evaluar `@shadcn/dashboard-01` y sumar primitives locales sin dependencias nuevas. El bloque completo queda como referencia en `docs/design/shadcn-blocks/`; en producto se agregan `RiskRegisterBlock` y `EvidenceLedgerBlock` al renderer generativo, con demo en `/dashboard/blocks-demo`.
- 🟢 **M** — **Voice input**. PM en obra con casco no escribe. Web Speech API.
- 🟢 **L** — **PWA + offline básico**. Tablet en obra sin wifi.

### 2.5 · Seguridad

- ✅ 2026-05-16 — **PII scanning en uploads**. Detecta CUIT/CUIL/DNI/CBU/email/teléfono en texto auditable y advierte al usuario antes de auditar.
- ✅ 2026-05-16 — **Audit log inmutable**. `audit_log_events` append-only con hash encadenado, triggers anti-update/delete y logging inicial de uploads/chat.
- ✅ 2026-05-19 — **Auth strict mode production-safe**. `verifyUserId()` valida JWT contra InsForge y ahora rechaza tokens no verificables por defecto en `NODE_ENV=production`; `AUTH_STRICT_MODE=false` queda solo como break-glass explícito. Documentado en `.env.local.example` y README, con test unitario.

### 2.6 · Agent Core + Expedientes Operativos (foco vigente)

Diagnóstico 2026-05-17: el agente ya tiene capacidades fuertes, pero el producto todavía se siente como historial de chats + tools acumuladas. El siguiente salto no es sumar más tools: es ordenar el trabajo operativo por obra y expediente.

- ✅ 2026-05-17 — **Plan Agent Core documentado**. `docs/08_agent_core_redesign.md` define el modelo `Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos`, responsabilidades, entidades recomendadas, capacidades objetivo y migración incremental.
- ✅ 2026-05-17 — **Hardening inicial de `projectId`**. `/api/upload` y `/api/sessions` validan que el `projectId` recibido desde cliente pertenezca a la `organization_id` autenticada antes de persistir asociaciones.
- ✅ 2026-05-17 — **Skeleton no invasivo de `src/lib/agent-core/`**. Tipos de scope/caso/capacidad, registry conceptual, builder puro de scope y composición inicial de prompt modules.
- ✅ 2026-05-17 — **Wiring audit-only en `/api/chat`**. El chat calcula `agentCore.scope` y `capabilityIds` y los persiste en `audit_log_events.payload.agentCore`, sin cambiar prompt efectivo ni set de tools.
- ✅ 2026-05-17 — **Migración inicial de expedientes operativos**. `migrations/20260517210141_work-cases.sql` crea `work_cases` (kind/status/title/summary/owner/closed_at/metadata + soft-delete), `work_case_events` (bitácora append-only con `event_type` libre + `payload JSONB`) y `work_case_evidence` (vínculos tipados a `file`/`chunk`/`relation`/`audit_event`/`tool_run`/`finding`/`message`/`schedule_task`/`hse_record`/`supply_item`/`financial_snapshot`/`subcontract`/`external` con confidence opcional). RLS estricto por `organization_id`, índices por org/project/status/kind/created_at, rol `project_admin` con acceso completo para backend. Sin cambios en APIs, prompt ni UX en este bloque.
- ✅ 2026-05-17 — **Asociar nuevas sesiones a expediente (backward-compatible)**. Migración `20260517210757_chat-session-work-case-link.sql` agrega `chat_sessions.work_case_id` nullable con FK a `work_cases` e índices parciales. `POST /api/sessions` (`src/app/api/sessions/route.ts`) ahora, cuando hay `projectId` válido y la sesión es nueva, crea un `work_case` con `kind` inferido del `fileType` (`excel → budget_audit`, `pdf/docx/dxf/image → document_audit`, default `general`) y registra el evento `chat_session.linked` vía `ensureWorkCaseForChatSession()` (en `src/lib/agent-core/work-case-writer.ts`). Idempotente al re-upsert. Sesiones legacy y sesiones sin `projectId` quedan con `work_case_id = NULL`. Sin cambios de UX, prompt, ni `/api/chat`. Tipos `WorkCaseKind`/`WorkCaseStatus` quedaron alineados al CHECK de la migración previa.
- ✅ 2026-05-17 — **Wire audit-only de `workCaseId` en `/api/chat`**. `DefaultChatTransport` envía `x-chat-session-id`; `src/proxy.ts` lo permite en CORS; `/api/chat` lo valida server-side buscando `chat_sessions` por `organization_id`, `user_id`, `id` y `deleted_at IS NULL`. Si la sesión tiene `work_case_id`, `agentCore.scope.workCaseId` queda persistido en `audit_log_events.payload`; si trae `project_id` y no venía `projectId` por header, se usa como obra validada. Al cerrar el turno, se agrega best-effort `work_case_events.event_type = 'chat.turn_completed'` con telemetría mínima. Sin cambios en prompt, tools, UX ni respuestas al cliente.
- ✅ 2026-05-18 — **Separar hallazgos vivos del audit log**. Migración `20260518001800_operational-findings.sql` crea `operational_findings` con RLS por `organization_id`, estado vivo (`open/resolved/dismissed`), clave estable por hallazgo y upsert por `organization_id, project_id, finding_key`. `runDailyProjectScan()` reemplaza hallazgos por obra y resuelve los que ya no aparecen; `/api/proactivity/findings` y `buildDailyBrief()` leen desde `operational_findings`. `audit_log_events` conserva solo resumen/findingKeys como evidencia append-only.
- ✅ 2026-05-18 — **Primer UI de expediente**. `GET /api/work-cases` lista expedientes por obra/org con sesión de chat asociada para el usuario actual. `/dashboard/obras/[id]` muestra expedientes recientes/abiertos y permite abrir el chat vinculado al expediente sin eliminar la compatibilidad del historial de sesiones.
- ✅ 2026-05-18 — **Migración legacy de sesiones**. Migración `20260518002617_legacy-work-cases.sql` crea expedientes `legacy_conversation` desde `chat_sessions` con `project_id`, vincula `chat_sessions.work_case_id`, registra evento `chat_session.legacy_linked` y agrega evidencia de snapshot/mensajes y archivos cuando el historial permite inferirlos por `fileId` o `__file_meta__`/nombre de archivo.
- ✅ 2026-05-18 — **Modularizar runtime del agente sobre Agent Core**. `src/lib/agent-core/runtime.ts` concentra resolución de scope, validación server-side de obra/sesión, recent sessions, patrones aprendidos, prompt efectivo, tools bound y `capabilityIds`. `/api/chat` conserva streaming, telemetría y audit writes. Sin cambios de comportamiento en prompt efectivo ni catálogo de tools.
- ✅ 2026-05-18 — **Vista de trazabilidad de expediente**. `GET /api/work-cases/[id]` devuelve cabecera, eventos y evidencias del expediente filtrado por `organization_id`. Nueva vista `/dashboard/obras/[id]/expedientes/[workCaseId]` muestra métricas, replay de eventos con payload expandible y evidencia vinculada con metadata expandible, más acceso al chat asociado.
- ✅ 2026-05-18 — **Agent runs y acciones de expediente**. Migración `20260518004152_agent-runs.sql` crea `agent_runs` con RLS por `organization_id` para registrar cada ejecución del agente con modelo, tier, scope, sesión, expediente, usage y telemetría de tools. `/api/chat` escribe `agent_runs` best-effort al finalizar el turno, vincula el `agentRunId` al audit log y al evento `work_case_events.chat.turn_completed`. `PATCH /api/work-cases/[id]` permite a `admin`/`engineer` resolver, cerrar, archivar o reabrir expedientes y registra `work_case_events.work_case.status_changed`; la vista de expediente suma acciones `Resolver`, `Cerrar` y `Reabrir`.
- ✅ 2026-05-18 — **Document intelligence reports**. Migración `20260518104406_document-intelligence-reports.sql` crea `document_intelligence_reports` con RLS por `organization_id` para persistir clasificación, extracción, riesgos, hallazgos, veredicto y confianza por archivo. `/api/upload` escribe un reporte `upload_scan` best-effort usando el procesamiento existente, PII scan y context scan. `work_case_evidence` suma `document_report`; cuando el upload o la creación posterior de sesión pueden resolver expediente, el reporte queda vinculado como evidencia documental.
- ✅ 2026-05-18 — **Cierre de expediente con veredicto + reportes documentales en UI**. Migración `20260518190721_work-case-verdict-closure.sql` agrega `work_cases.verdict` (CHECK ∈ {`approved`,`flagged`,`inconclusive`,`rejected`,`superseded`}) y `work_cases.closed_by_user_id`. `GET /api/work-cases/[id]` ahora devuelve los `document_intelligence_reports` del expediente con `fileName` resuelto desde `uploaded_files`. `PATCH /api/work-cases/[id]` acepta `verdict` y `summary`, marca `closed_by_user_id` cuando entra a estado terminal y lo limpia al reabrir; el evento `work_case.status_changed` queda con `previousVerdict`/`verdict`/`summary`/`closedByUserId` en el payload. `/dashboard/obras/[id]/expedientes/[workCaseId]` renderiza una sección "Reportes documentales" con clasificación, riesgos, hallazgos expandibles y veredicto/confianza por reporte; las acciones `Resolver`/`Cerrar` abren un modal con selector de veredicto y textarea de resumen editable antes del estado terminal.
- ✅ 2026-05-18 — **Cierre agéntico de expediente**. Tool `proponer_cierre_expediente` permite que el agente marque el expediente activo como `resolved` con `verdict`, `summary` y evidencia citable cuando ya completó la auditoría. El prompt recibe `workCaseId` solo desde sesión validada, `createBoundTools()` inyecta `organization_id`/actor server-side y `closeWorkCaseFromAgent()` rechaza expedientes de otra organización o ya terminales antes de escribir estado, evento y evidencia opcional.
- ✅ 2026-05-18 — **Vista global de expedientes**. Nueva ruta `/dashboard/expedientes` y navegación lateral para ver expedientes de toda la organización, agrupar por `status` o `verdict`, buscar por título/resumen/obra/tipo, filtrar por estado y abrir detalle/chat cuando existe obra/sesión asociada. `useWorkCases()` acepta `limit` para la vista global.

#### Evaluación de pendientes existentes contra Agent Core

- **Mantener y adaptar**: Capa de Contexto Empresarial, knowledge graph, replay de auditoría y "por qué" expandible. Son útiles, pero deben apoyarse en `work_case_evidence` / `agent_runs`, no en sesiones sueltas.
- **Reordenar**: Motor de proactividad. Activar el schedule público sirve, pero antes conviene crear `operational_findings`; si no, seguimos usando `audit_log_events` como read model de producto.
- **Completado**: Memoria activa escribible como tool `recordar_aprendizaje`, con confirmación explícita, evidencia obligatoria y scope de expediente/obra inyectado server-side.
- **Dejar para después**: Voice input, PWA/offline, external auditor. Tienen valor, pero no corrigen el modelo mental central.

---

## 3 · Recomendación de orden (si tuvieras 1 semana)

Orden actualizado para el foco Agent Core:

1. ✅ Documentar Agent Core y crear skeleton no invasivo (§2.6).
2. ✅ Validar `projectId` recibido desde cliente en rutas críticas (§2.6).
3. ✅ Registrar `agentCore.scope` / `capabilityIds` en audit payload sin cambiar comportamiento (§2.6).
4. ✅ Crear migración `work_cases`, `work_case_events`, `work_case_evidence`.
5. ✅ Asociar nuevas sesiones a `work_case_id` (server-side, backward-compatible).
6. ✅ Wire opcional `x-chat-session-id` en `/api/chat` para que `agentScope.workCaseId` se persista en `audit_log_events.payload.agentCore.scope.workCaseId`.
7. ✅ Separar `operational_findings` de `audit_log_events` y migrar proactividad/daily brief a ese read model.
8. ✅ Cambiar UX de "Historial" a "Expedientes recientes" por obra.
9. ✅ Modularizar prompt/tools sobre capacidades de Agent Core.
10. ✅ Crear `agent_runs` y acciones de resolución/cierre/reapertura de expedientes.
11. ✅ Crear `document_intelligence_reports` y vincular reportes documentales a expedientes/evidencia.
12. ✅ Exponer reportes documentales en `GET /api/work-cases/[id]` y en la vista de expediente; cerrar expedientes con `verdict` + `summary` editables (migración `20260518190721_work-case-verdict-closure.sql`).
13. ✅ Agregar cierre agéntico con `proponer_cierre_expediente`, limitado al `workCaseId` validado y con evidencia citable opcional.
14. ✅ Exponer listado global de expedientes agrupable por estado/veredicto.

Plan de migración Agent Core cerrado para esta etapa. Próxima línea de producto sugerida: avanzar con Contexto Empresarial o agregar detalle global para expedientes sin obra asociada.

---

## 4 · Cambios completados (registro corto)

Los items completados de los antiguos planes están reflejados en `git log` y en los blobs históricos de `docs/planning/*.md` (acceder vía `git show HEAD~N:docs/planning/TAREAS_CLAUDE.md` si hace falta arqueología). No los repetimos acá para mantener el ROADMAP enfocado en lo pendiente.

- ✅ 2026-05-16 — Helper `isAtLeast(role, minRole)` agregado en `src/lib/auth/require-auth.ts`; `requireAuth(req, { role })` ahora usa jerarquía explícita `admin > engineer > viewer`.
- ✅ 2026-05-18 — Provider DeepSeek migrado a `@ai-sdk/openai-compatible` para que el SDK extraiga y reinyecte `reasoning_content` automáticamente. Resuelve el error runtime de multi-turn en thinking mode. `next-themes` removido.
- ✅ 2026-05-18 — Sistema de temas propio (3 paletas: editorial/plano/oscuro) basado en `data-theme` + tokens OKLCH. Selector visual en la rueda de configuración. Anti-FOUC con script crítico en `<head>`.
- ✅ 2026-05-18 — `/api/super-admin/reset` convertido de herramienta de testing a operación útil: scope per-empresa (preserva org/miembros/founder_invitations, borra solo contenido operativo) o total con confirmación tipada server-side. UI con modal de confirmación + log post-ejecución.
- ✅ 2026-05-18 — Hardening de boundaries: validación Zod de `fetchRemoteMessages` (AI SDK `safeValidateUIMessages`) y respuesta NVIDIA NIM; logs estructurados en 5 sync no-bloqueantes; columna `indexing_status` en `uploaded_files` con badges en Fuentes de Inteligencia Empresarial (pending/degraded/failed + tooltip de error real). Smoke test E2E (`npm run smoke:chat`) corre 3 turnos contra DeepSeek y detecta regresiones del ciclo `reasoning_content`.
- ✅ 2026-05-19 — Recovery corto post-hardening: hook versionado `.githooks/pre-push` ejecutaba `npm run smoke:chat` al pushear cambios del runtime del agente (retirado 2026-06-11 por fricción/costo: el smoke queda como comando manual); `/api/documents/[id]/reindex` + CTA en `/dashboard/contexto/fuentes` permiten reintentar indexación de archivos `degraded`/`failed` desde Storage. Schedule de proactividad sigue pendiente hasta tener URL pública real.
- ✅ 2026-05-19 — Alerting local: `app_error_events`, helper `captureAppError()`, endpoint admin `GET/PATCH /api/admin/error-events` y vista `/dashboard/admin/errors` para listar/resolver fallas por tenant.
