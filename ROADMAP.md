# Roadmap — EdificIA

> Estado consolidado al **2026-05-17**.
> Este documento reemplaza los antiguos `docs/planning/*.md` (todos archivados).
>
> Convención de prioridad: 🔥 alto impacto · 🟡 medio · 🟢 nice-to-have
> Convención de esfuerzo: **S** = < 1 h · **M** = medio día · **L** = ≥ 1 día
>
> Foco vigente desde 2026-05-17: **Agent Core + Expedientes Operativos**. La prioridad de producto es que EdificIA deje de orbitar alrededor de sesiones de chat y se organice como `Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos`. Ver `docs/08_agent_core_redesign.md`.

---

## 1 · Pendientes heredados de docs/planning

### 1.1 · Infra / observabilidad

- 🟡 **M** — Sistema de alertas (Sentry o equivalente). Hoy no hay alerting en errores de prod.
- ✅ 2026-05-16 — WAL verification en PostgreSQL para self-hosted.
- 🟢 **M** — Estrategia de rollback automatizada (snapshot pre-deploy).
- 🟢 **L** — Performance profiling bajo carga real (cuando haya tráfico).

### 1.2 · Auth / roles

- 🟡 **M** — Rol "external auditor" con links de vista temporal (expiry).

### 1.3 · Dominio de obra (Gestión Integral)

Lo que falta del **plan original "Project Manager Digital"**:

- ✅ 2026-05-16 — **Arquitectura de datos extendida**. Agregadas tablas InsForge/PostgreSQL con RLS para cronograma (`project_schedule_tasks`), finanzas/curva S (`project_financial_snapshots`), subcontratos (`project_subcontracts`), HSE (`project_hse_records`) y acopios/suministros (`project_supply_items`). También se corrigió `projects.status` para usar los estados reales de la UI.
- 🔥 **L** — **Motor de proactividad**: CRON jobs / workers que corran análisis diario sobre las obras activas. Base 2026-05-16: `runDailyProjectScan()` + `/api/cron/project-proactivity` detectan riesgos de cronograma, HSE, suministros, curva S y documentación stale, y registran resumen en `audit_log_events`. UI 2026-05-16: `GET /api/proactivity/findings` + `useProactivityFindings()` + `ProactivityAlertsBanner` surfacean los hallazgos en el chat (filtrado opcional por obra activa). Pendiente: activar schedule InsForge contra una URL pública para que el scan corra diariamente sin trigger manual.
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
- ✅ 2026-05-16 — **Router de modelos**. `routeModel(messages)` clasifica por señales (archivo adjunto, A vs B, contradicciones, cross-doc, turno largo, hints explícitos) y devuelve tier `fast` o `deep`. Modelos via `AI_MODEL_FAST` / `AI_MODEL_DEEP` env vars (caen al `AI_MODEL` actual si no se setean — listo para apuntar a Claude Sonnet u otro proveedor "deep" cuando se agregue la API key). El audit log registra `tier`, `model` y `routeReason` por turno.
- ✅ 2026-05-17 — **Step budget tier-aware**. `stopWhen: stepCountIs(stepBudget)` ahora usa `stepBudget = tier === "deep" ? 35 : 20`. Persistido en audit log payload junto con `tier` y `routeReason`.
- ✅ 2026-05-17 — **Hypothesis branching**. Parser `extractHypothesis` en `src/lib/ai/hypothesis-parser.ts`, UI `HypothesisBlock` con ramas ordenadas por confianza, badge "elegida", barra de progreso por rama y rationale. Streaming-aware (oculta JSON parcial mientras el bloque no cerró). Prompt sección "Hipótesis con ramas" explica cuándo emitirlo (2-4 ramas, confianza decimal 0-1, evidencia obligatoria, `chosen` opcional para modo "pedir clarificación").
- ✅ 2026-05-17 — **Retry strategy estructurada**. Prompt sección "Retry estructurado cuando una tool falla" define patrón explícito: leer error → ajustar inputs → reintentar UNA vez → declarar límite. Lista casos donde NO reintentar (whitelist_blocked, ambiguous_task, sin_registro, no_api_key) y prohíbe loops de mismos inputs.
- ✅ 2026-05-17 — **Tool telemetry**. `summarizeToolUsage(steps)` en `src/lib/ai/tool-telemetry.ts` agrega per-tool `{ calls, errors, retries }` desde el array de steps del `onFinish`. `/api/chat` persiste `toolTelemetry` (filas ordenadas por calls desc) + totales en `audit_log_events.payload`. Severity del evento `chat.completed` escala a `warning` si hubo ≥1 error. Cobertura: 6 unit tests sobre conteo de calls, detección de errores (`ok:false`, `error:true`) y retries.
- 🟢 **L** — **Memoria activa escribible**. Hoy `recentSessions` se lee proactivamente y `company_learned_patterns` se actualiza offline por `session-learner`. Falta una tool `recordar_aprendizaje(key, evidencia)` que el agente invoque cuando descubre algo de valor para futuras sesiones.
- ✅ 2026-05-16 — **Memoria de usuario activa**. `recentSessions` ahora se usa proactivamente cuando coincide obra/tipo de archivo reciente.
- ✅ 2026-05-16 — **Confidence + provenance**. Cada cifra crítica del resumen debe llevar fuente documental y tool de cómputo.

### 2.2 · Profundidad de dominio

- 🔥 **L** — **Capa de Contexto Empresarial**. Evolucionar la Base Documental hacia conectores seguros de solo lectura, inventario empresarial, extracción de obras activas, clasificación documental y auditoría transversal de la constructora completa. Ver `docs/06_enterprise_context_layer.md`.
- ✅ 2026-05-16 — **Knowledge graph de obra (lectura)**. Migración `obra_relations` con tipos `contradicts/derives_from/supersedes/references/duplicates`, confianza 0-1, `detected_by` (system/agent/user), evidencia JSONB y RLS por org. Auto-populate desde `context-scan` cuando detecta contradicciones (system, dedupe por unique index parcial). Tool agente `buscar_relaciones_documento` resolve por `fileId` o `fileName`, filtra por tipo/proyecto y devuelve relaciones con dirección outgoing/incoming.
- ✅ 2026-05-17 — **Knowledge graph (resolución)**. Tool `resolver_relacion_documental` con acciones `confirm` / `dismiss` / `supersede` permite cerrar contradicciones detectadas automáticamente. `dismiss` soft-deletea con resolución registrada; `confirm` eleva confidence a 1 y marca `detected_by=user`; `supersede` crea relación nueva en sentido inverso y descarta la original.
- 🟡 **M** — **Knowledge graph (extensión semántica)**. Auto-populate de `derives_from` cuando un Excel/PDF cita el `task_code` o nombre de otro doc. Auto-populate de `supersedes` al detectar versión Vx → Vx+1 por fileName.
- 🟢 **M** — **Knowledge graph (UI exploratoria)**. Vista `/dashboard/obras/[id]/graph` que renderiza el grafo con nodos por archivo y aristas tipadas. Hoy se consulta solo via chat.
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
- 🟡 **M** — **"Por qué" expandible en hallazgos**. Click en un hallazgo crítico → modal con evidencia (tool usada, inputs, outputs raw, doc fuente con highlight). Refuerza confianza del PM antes de actuar.
- 🟡 **M** — **Replay de auditoría**. Reproducir el plan paso a paso con cada tool call. Útil para QA, debugging y aprendizaje del equipo. Hoy `audit_log_events` tiene la data; falta UI.
- ✅ 2026-05-17 — **Día en la obra**. Dashboard `/dashboard/obras/[id]/today` con brief operativo de un día: cronograma vencido/bloqueado/próximo, HSE, acopios, curva S, alertas de proactividad, clima si hay ubicación y CTA "Auditar lo nuevo".
- 🟢 **M** — **Voice input**. PM en obra con casco no escribe. Web Speech API.
- 🟢 **L** — **PWA + offline básico**. Tablet en obra sin wifi.

### 2.5 · Seguridad

- ✅ 2026-05-16 — **PII scanning en uploads**. Detecta CUIT/CUIL/DNI/CBU/email/teléfono en texto auditable y advierte al usuario antes de auditar.
- ✅ 2026-05-16 — **Audit log inmutable**. `audit_log_events` append-only con hash encadenado, triggers anti-update/delete y logging inicial de uploads/chat.

### 2.6 · Agent Core + Expedientes Operativos (foco vigente)

Diagnóstico 2026-05-17: el agente ya tiene capacidades fuertes, pero el producto todavía se siente como historial de chats + tools acumuladas. El siguiente salto no es sumar más tools: es ordenar el trabajo operativo por obra y expediente.

- ✅ 2026-05-17 — **Plan Agent Core documentado**. `docs/08_agent_core_redesign.md` define el modelo `Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos`, responsabilidades, entidades recomendadas, capacidades objetivo y migración incremental.
- ✅ 2026-05-17 — **Hardening inicial de `projectId`**. `/api/upload` y `/api/sessions` validan que el `projectId` recibido desde cliente pertenezca a la `organization_id` autenticada antes de persistir asociaciones.
- ✅ 2026-05-17 — **Skeleton no invasivo de `src/lib/agent-core/`**. Tipos de scope/caso/capacidad, registry conceptual, builder puro de scope y composición inicial de prompt modules.
- ✅ 2026-05-17 — **Wiring audit-only en `/api/chat`**. El chat calcula `agentCore.scope` y `capabilityIds` y los persiste en `audit_log_events.payload.agentCore`, sin cambiar prompt efectivo ni set de tools.
- 🔥 **M** — **Migración inicial de expedientes operativos**. Crear `work_cases`, `work_case_events` y `work_case_evidence` con RLS por `organization_id`. Primera versión: expedientes por obra, tipo, estado, título, owner, timestamps y links a evidencia.
- 🔥 **M** — **Asociar nuevas sesiones a expediente**. Mantener `chat_sessions` legacy, pero crear/usar `work_case_id` para nuevas conversaciones iniciadas desde obra/documento/brief. No migrar UI todavía.
- 🔥 **M** — **Separar hallazgos vivos del audit log**. Crear `operational_findings` o read model equivalente para proactividad/daily brief. `audit_log_events` debe quedar como evidencia inmutable, no como tabla primaria de estado.
- 🟡 **M** — **Primer UI de expediente**. En obra, mostrar expedientes recientes/abiertos y permitir abrir chat dentro de un expediente. La sidebar de sesiones debe pasar a segundo plano.
- 🟡 **L** — **Migración legacy de sesiones**. Crear expedientes `legacy_conversation` desde `chat_sessions` por `project_id`, asociando mensajes, archivos y eventos cuando haya `fileId` o `__file_meta__`.
- 🟡 **L** — **Modularizar prompt/tools sobre Agent Core**. Recién después de tener expedientes, mover `agent-prompt.ts` a módulos runtime y agrupar tools en capacidades (`context.search`, `document.audit`, `budget.audit`, `project.brief`, `operations.update`, `documents.generate`, `communications.*`).

#### Evaluación de pendientes existentes contra Agent Core

- **Mantener y adaptar**: Capa de Contexto Empresarial, knowledge graph, replay de auditoría y "por qué" expandible. Son útiles, pero deben apoyarse en `work_case_evidence` / `agent_runs`, no en sesiones sueltas.
- **Reordenar**: Motor de proactividad. Activar el schedule público sirve, pero antes conviene crear `operational_findings`; si no, seguimos usando `audit_log_events` como read model de producto.
- **Diferir**: Memoria activa escribible como tool `recordar_aprendizaje`. Debe esperar al modelo de expedientes/memoria empresarial para no sumar otra tool suelta.
- **Dejar para después**: Voice input, PWA/offline, external auditor. Tienen valor, pero no corrigen el modelo mental central.

---

## 3 · Recomendación de orden (si tuvieras 1 semana)

Orden actualizado para el foco Agent Core:

1. ✅ Documentar Agent Core y crear skeleton no invasivo (§2.6).
2. ✅ Validar `projectId` recibido desde cliente en rutas críticas (§2.6).
3. ✅ Registrar `agentCore.scope` / `capabilityIds` en audit payload sin cambiar comportamiento (§2.6).
4. 🔥 Crear migración `work_cases`, `work_case_events`, `work_case_evidence`.
5. 🔥 Asociar nuevas sesiones/chat turns a `work_case_id`.
6. 🔥 Separar `operational_findings` de `audit_log_events` y migrar proactividad/daily brief a ese read model.
7. 🟡 Cambiar UX de "Historial" a "Expedientes recientes" por obra.
8. 🟡 Modularizar prompt/tools sobre capacidades de Agent Core.

Siguiente bloque recomendado: **migración inicial de expedientes operativos** (`work_cases`, `work_case_events`, `work_case_evidence`) con RLS por `organization_id`.

---

## 4 · Cambios completados (registro corto)

Los items completados de los antiguos planes están reflejados en `git log` y en los blobs históricos de `docs/planning/*.md` (acceder vía `git show HEAD~N:docs/planning/TAREAS_CLAUDE.md` si hace falta arqueología). No los repetimos acá para mantener el ROADMAP enfocado en lo pendiente.

- ✅ 2026-05-16 — Helper `isAtLeast(role, minRole)` agregado en `src/lib/auth/require-auth.ts`; `requireAuth(req, { role })` ahora usa jerarquía explícita `admin > engineer > viewer`.
