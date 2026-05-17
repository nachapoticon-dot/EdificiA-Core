# Roadmap — EdificIA

> Estado consolidado al **2026-05-16**.
> Este documento reemplaza los antiguos `docs/planning/*.md` (todos archivados).
>
> Convención de prioridad: 🔥 alto impacto · 🟡 medio · 🟢 nice-to-have
> Convención de esfuerzo: **S** = < 1 h · **M** = medio día · **L** = ≥ 1 día

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

---

## 2 · Mejoras estratégicas (propuestas Opus, 2026-05-16)

### 2.1 · Inteligencia del agente (lo que más cambia el producto)

- ✅ 2026-05-16 — **Lectura agéntica de documentos**. Prompt y UX migrados a ciclo de clasificación, hipótesis, extracción, contraste, verificación y síntesis.
- ✅ 2026-05-16 — **Plan-then-execute**. El agente emite bloque `<plan>` antes de usar múltiples tools y la UI lo renderiza como plan de auditoría.
- ✅ 2026-05-16 — **Self-critique pre-respuesta**. Checklist de auto-verificación incorporada al prompt antes del cierre.
- ✅ 2026-05-16 — **Router de modelos**. `routeModel(messages)` clasifica por señales (archivo adjunto, A vs B, contradicciones, cross-doc, turno largo, hints explícitos) y devuelve tier `fast` o `deep`. Modelos via `AI_MODEL_FAST` / `AI_MODEL_DEEP` env vars (caen al `AI_MODEL` actual si no se setean — listo para apuntar a Claude Sonnet u otro proveedor "deep" cuando se agregue la API key). El audit log registra `tier`, `model` y `routeReason` por turno.
- ✅ 2026-05-16 — **Memoria de usuario activa**. `recentSessions` ahora se usa proactivamente cuando coincide obra/tipo de archivo reciente.
- ✅ 2026-05-16 — **Confidence + provenance**. Cada cifra crítica del resumen debe llevar fuente documental y tool de cómputo.

### 2.2 · Profundidad de dominio

- 🔥 **L** — **Capa de Contexto Empresarial**. Evolucionar la Base Documental hacia conectores seguros de solo lectura, inventario empresarial, extracción de obras activas, clasificación documental y auditoría transversal de la constructora completa. Ver `docs/06_enterprise_context_layer.md`.
- ✅ 2026-05-16 — **Knowledge graph de obra**. Migración `obra_relations` con tipos `contradicts/derives_from/supersedes/references/duplicates`, confianza 0-1, `detected_by` (system/agent/user), evidencia JSONB y RLS por org. Auto-populate desde `context-scan` cuando detecta contradicciones (system, dedupe por unique index parcial). Nueva tool agente `buscar_relaciones_documento` resolve por `fileId` o `fileName`, filtra por tipo/proyecto y devuelve relaciones con dirección outgoing/incoming.
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
- 🟢 **M** — **Voice input**. PM en obra con casco no escribe. Web Speech API.
- 🟢 **L** — **PWA + offline básico**. Tablet en obra sin wifi.

### 2.5 · Seguridad

- ✅ 2026-05-16 — **PII scanning en uploads**. Detecta CUIT/CUIL/DNI/CBU/email/teléfono en texto auditable y advierte al usuario antes de auditar.
- ✅ 2026-05-16 — **Audit log inmutable**. `audit_log_events` append-only con hash encadenado, triggers anti-update/delete y logging inicial de uploads/chat.

---

## 3 · Recomendación de orden (si tuvieras 1 semana)

1. ✅ Limpieza workspace + reorganización (hecho 2026-05-16).
2. ✅ Consolidar migrations (§2.3).
3. ✅ Definir Capa de Contexto Empresarial (§2.2, documentación de producto/arquitectura).
4. ✅ Lectura agéntica + plan-then-execute + self-critique (§2.1).
5. ✅ Auto-detección de contradicciones al subir (§2.2).
6. ✅ Tests base del math-engine + parser Excel (§2.3).
7. ✅ Onboarding de índices (§2.4).

Siguiente bloque recomendado: completar el motor de proactividad — activar schedule InsForge contra una URL pública y surfacear las alertas en la UI del dashboard.

---

## 4 · Cambios completados (registro corto)

Los items completados de los antiguos planes están reflejados en `git log` y en los blobs históricos de `docs/planning/*.md` (acceder vía `git show HEAD~N:docs/planning/TAREAS_CLAUDE.md` si hace falta arqueología). No los repetimos acá para mantener el ROADMAP enfocado en lo pendiente.

- ✅ 2026-05-16 — Helper `isAtLeast(role, minRole)` agregado en `src/lib/auth/require-auth.ts`; `requireAuth(req, { role })` ahora usa jerarquía explícita `admin > engineer > viewer`.
