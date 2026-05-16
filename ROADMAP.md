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
- 🟢 **S** — WAL verification en PostgreSQL para self-hosted.
- 🟢 **M** — Estrategia de rollback automatizada (snapshot pre-deploy).
- 🟢 **L** — Performance profiling bajo carga real (cuando haya tráfico).

### 1.2 · Auth / roles

- 🟡 **S** — Helper `isAtLeast(role, minRole)` con jerarquía explícita (`admin > engineer > viewer`). Hoy `requireAuth(req, { role: "admin" })` rechaza engineers; documentar o flexibilizar.
- 🟡 **M** — Rol "external auditor" con links de vista temporal (expiry).

### 1.3 · Dominio de obra (Gestión Integral)

Lo que falta del **plan original "Project Manager Digital"**:

- 🔥 **L** — **Arquitectura de datos extendida**: tablas para cronograma, finanzas (curva S), directorio de subcontratos, HSE (ART/EPP), acopios y suministros. Hoy solo existen `projects` y `uploaded_files`.
- 🔥 **L** — **Motor de proactividad**: CRON jobs / workers que corran análisis diario sobre las obras activas. Hoy todo es reactivo (responde cuando preguntás).
- 🔥 **M** — **Integración meteorológica real**: verificar si `evaluar_impacto_clima` pega contra Open-Meteo (o similar) o es mock. Conectar si no.
- 🔥 **M** — **Tools nuevas para el agente**:
  - `verificar_ingreso_personal(cuadrilla)` — valida ART/EPP vigentes.
  - `reprogramar_e_informar(tarea, fecha)` — emite reprogramación + notifica stakeholders.
  - `auditar_curva_inversion()` — compara avance financiero real vs curva S planificada.

---

## 2 · Mejoras estratégicas (propuestas Opus, 2026-05-16)

### 2.1 · Inteligencia del agente (lo que más cambia el producto)

- 🔥 **M** — **Plan-then-execute**. Antes de invocar tools, el agente emite un plan JSON (`{steps:[{tool,why,expected}]}`) y se compromete a él. Reduce las "5 tools sueltas" porque hay un plan auditable previo.
- 🔥 **M** — **Self-critique pre-respuesta**. Antes de cerrar el resumen, el agente revisa sus números contra una checklist y se corrige. DeepSeek aún se equivoca aritméticamente en casos de borde — esto los caza.
- 🟡 **M** — **Router de modelos**. DeepSeek V3 para chitchat/tareas simples, Claude Sonnet 4.6+ para razonamiento complejo (cruzar 3 docs, detectar contradicciones). Cost-aware.
- 🟡 **S** — **Memoria de usuario activa**. `recentSessions` se inyecta al prompt pero no se *usa*. Surfacear proactivamente: "veo que ayer auditaste Casa Lomas, ¿comparamos con este?".
- 🟢 **M** — **Confidence + provenance**. Cada número del resumen muestra de qué tool salió y con qué confianza. Construye trust del PM.

### 2.2 · Profundidad de dominio

- 🔥 **L** — **Knowledge graph de obra**. Tabla `obra_relations` (doc A *contradice* doc B, doc C *deriva de* doc D). Habilita queries del estilo "¿qué docs se contradicen?".
- 🔥 **M** — **Auto-detección de contradicciones al subir**. Al ingresar un PDF, compararlo contra docs existentes del proyecto y flaguear inconsistencias automáticamente (memoria dice X, presupuesto dice Y).
- 🟡 **M** — **Cronograma real (no demo)**. `proyectar_cronograma` pinta cosas — falta la fuente de datos: import MS Project / CSV / builder manual.

### 2.3 · Calidad de código

- 🔥 **M** — **Tests unitarios**. Cero tests hoy. En auditoría financiera es serio. Empezar por `src/lib/math-engine/` + `src/lib/excel/parser`.
- 🔥 **S** — **Consolidar migrations**. Coexisten `db/migrations/` (raw SQL, vía `scripts/migrate.js` para Docker local) y `migrations/` (InsForge CLI, prefijo timestamp). Hay duplicados (`db/migrations/015_founder_invitation_org.sql` ≈ `migrations/20260515032815_add-founder-columns.sql`). Decidir cuál es canónica y sincronizar / eliminar la otra. **Bug-magnet activo.**
- 🟡 **M** — **Zod schemas para responses de API**. Hoy las routes devuelven `Record<string, unknown>`. Tipar para evitar drift cliente-servidor.
- 🟡 **S** — **Correlation IDs en logger**. Middleware que inyecta un `requestId` en el contexto Pino para trackear un request end-to-end.
- 🟢 **S** — **Sub-organizar `src/components/chat/`**. 21+ archivos en una sola carpeta. Sub-dividir en `chat/blocks/`, `chat/sidebar/`, `chat/input/`, `chat/cards/`.

### 2.4 · UX / Producto

- 🔥 **S** — **Onboarding forzado de índices**. Si la org no tiene índices de precios cargados, `comparar_con_indices` es muerto. Detectar y mostrar wizard al admin.
- 🟡 **M** — **Side-by-side upload (A vs B)**. La tool `comparar_presupuestos` existe; falta la UI para subir 2 archivos a la vez. Killer feature para PMs.
- 🟢 **M** — **Voice input**. PM en obra con casco no escribe. Web Speech API.
- 🟢 **L** — **PWA + offline básico**. Tablet en obra sin wifi.

### 2.5 · Seguridad

- 🟡 **M** — **PII scanning en uploads**. Presupuestos a veces traen CUIT/DNI. Detectar y avisar al admin.
- 🟢 **M** — **Audit log inmutable**. Las auditorías deberían ser write-once. Importante legal.

---

## 3 · Recomendación de orden (si tuvieras 1 semana)

1. ✅ Limpieza workspace + reorganización (hecho 2026-05-16).
2. **Consolidar migrations** (§2.3) — cierra el bug-magnet ahora.
3. **Plan-then-execute + self-critique** (§2.1) — 70 % del salto de calidad del agente.
4. **Auto-detección de contradicciones al subir** (§2.2) — killer feature de dominio.
5. **Tests del math-engine** (§2.3) — red de seguridad para todo lo demás.
6. **Onboarding de índices** (§2.4) — desbloquea valor que ya existe.

Si tenés solo **1 día**: 2, 3 y 6.

---

## 4 · Cambios completados (registro corto)

Los items completados de los antiguos planes están reflejados en `git log` y en los blobs históricos de `docs/planning/*.md` (acceder vía `git show HEAD~N:docs/planning/TAREAS_CLAUDE.md` si hace falta arqueología). No los repetimos acá para mantener el ROADMAP enfocado en lo pendiente.
