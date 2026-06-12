# EdificIA — Producto y estado

> **El único documento vivo de estado.** Reemplaza a `ROADMAP.md` y `PROXIMOS_PASOS.md` (historia en git).
> Última actualización: 2026-06-11.

## Qué es EdificIA (visión canónica)

EdificIA es el **sistema operativo de una empresa constructora**, con un agente de IA que actúa como **Project Manager Digital continuo**: entiende obras, documentos, presupuestos, riesgos y decisiones, y deja cada decisión conectada con evidencia.

- El chat es **una interfaz, no el centro** del producto.
- El centro es el modelo `Empresa → Obra → Expediente Operativo → Eventos/Evidencias/Acciones/Artefactos`.
- La **auditoría documental es una capacidad** del agente (se activa cuando llega un documento o se la piden) — **no es su identidad**. La identidad es la gestión operativa: estado de obra, cronograma, HSE, clima, finanzas (curva S), acopios, subcontratos, comunicación y generación de artefactos con trazabilidad.
- Las tools son instrumentos, no el razonamiento. El agente lee, forma hipótesis, contrasta con contexto de empresa/obra, verifica con tools y sintetiza hechos/riesgos/acciones.

Mapa técnico (stack, arquitectura, flujos): `EXPLICACION_PROYECTO_PARA_VOS.md`.

## Estado actual del sistema (2026-06-11)

- **Infraestructura 100% propia** (desconexión de InsForge/Qdrant completada): PostgreSQL 16 + pgvector, auth local (JWT HS256 + refresh con rotación), storage filesystem, runner de migraciones propio. Únicos externos: DeepSeek (LLM) y NVIDIA NIM (embeddings).
- **Agente con dos backends**: runtime TS embebido (default) y **cerebro Python** (`services/agent/`, FastAPI) detrás de `AGENT_BACKEND=python`, con tool gateway (`/api/internal/tools/*`). Ambos consumen el mismo prompt compuesto.
- **Aprendizaje real**: `agent_memories` (embedding + scope + confianza) con reflexión LLM post-turno, feedback explícito (`agent_feedback`) y decay/refuerzo. Retrieval semántico inyectado al prompt.
- **Identidad del agente re-centrada**: prompt modular por capacidades, apertura operativa, modos con tools filtradas, evals de conducta.
- Operación local: `colima start` → `docker compose up -d postgres` → `npm run migrate` → `npm run dev` (+ opcional `services/agent` con uvicorn). Apagar todo: `colima stop`.

## Pendientes vigentes

### Producto / agente
- Migrar tools TS → Python de a una (el gateway lo permite gradual).
- Deprecar `company_learned_patterns` cuando `agent_memories` cubra sus usos (perfil empresarial sigue leyéndose como contexto).
- UI de feedback más rica: rating positivo y corrección inline (hoy: botón "respuesta incorrecta" + persistencia).
- Conectar Expedientes al flujo de usuario como contenedor primario (el chat como canal del expediente — visión 08).

### Seguridad / operación (auditoría 2026-06-12)
- **RLS real o asumido como app-level.** Hoy las policies RLS no aplican: el pool (`src/lib/db/pool.ts`) conecta como owner y las bypassea (`bootstrap-local.sql` lo admite). El aislamiento entre orgs depende 100% del `.eq("organization_id")` en código. Decidir: rol no-owner + `SET LOCAL` (GUC) por transacción en el query-builder, o aceptar formalmente el modelo app-level. Docs ya corregidos para no prometer RLS activo.
- **Unificar sesión en cookie httpOnly.** Conviven cookie `edificia_session` (middleware) y access+refresh tokens en `localStorage` (~27 archivos vía `getAuthHeaders`). `localStorage` es legible por XSS y los dos mecanismos pueden desincronizarse. Objetivo: un solo token en cookie httpOnly + SameSite que sirva para middleware y API (con `requireAuth` aceptando cookie), refresh server-side; eliminar `getAuthHeaders()` y su lógica de renovación en cliente.
- **Trazabilidad sin best-effort.** `agent_runs`, eventos de expediente y `audit_log_events` se escriben tragando errores (`agent-run-writer.ts` → warn + null). Si la trazabilidad es propuesta de valor, no puede fallar en silencio: outbox simple o cola de reintentos en la misma Postgres.
- **Backups + monitoreo.** "100% infra propia" sin estrategia de backup de Postgres ni monitoreo es el mayor riesgo operativo actual. Definir antes de cualquier deploy real.
- Hecho 2026-06-12: rate limit agregado a `forgot-password` y `reset-password` (eran las únicas rutas de auth sin limitar; spam de Resend gratis).

### Calidad
- Tests de integración auth + multi-tenancy (que una org no pueda ver datos de otra: `requireAuth`, una ruta con orgId, RLS).
- Revisar suppressions `exhaustive-deps` en `chat/page.tsx` (riesgo de stale-closure en el stream).
- Deuda menor: `UNIQUE(organization_id, user_id)` en members es completo, no parcial por `deleted_at` (re-invitar a un miembro soft-deleted falla).

### Decisiones de producto abiertas
- **Cerrar la dualidad de backends del agente con fecha.** Dos runtimes (TS default + Python tras flag) implican drift de lógica, dos suites de evals y la superficie de auth interna del gateway. La dualidad es aceptable solo como transición; si la dirección es el cerebro Python (los pendientes de migración de tools lo sugieren), fijar el criterio de corte para borrar el runtime TS — o al revés.
- **Inteligencia Empresarial**: hacer UN conector real read-only end-to-end (ej. Drive OAuth) o bajar la narrativa a lo que hace hoy (`manual_upload`). No dejar fachada.
- **Motor de proactividad**: desplegar el schedule (requiere URL pública + `CRON_SECRET`) o marcarlo congelado.
- Inventario de features dormidas: para cada una, activar / simplificar / borrar.

### Externos (bloqueados por terceros)
- URL pública + deployment estable.
- Conectores reales (Drive/SharePoint/SQL/ERPs): requieren OAuth + credenciales del cliente.
- Infraestructura definitiva para el servicio Python (es portable: Postgres + env vars).

## Backlog especulativo (no comprometido)

Ideas de largo plazo, ninguna planificada: DWG nativo (hoy se rechaza con guía), OCR de PDF escaneado (ya se detecta `isScanned`), BIM/IFC, cómputo métrico automático desde DXF, edición CAD bidireccional, comparación de presupuestos entre proyectos, dashboard BI de "fuga de rentabilidad".
