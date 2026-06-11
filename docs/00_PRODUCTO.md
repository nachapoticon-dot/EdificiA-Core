# EdificIA — Producto y estado

> **El único documento vivo de estado.** Reemplaza a `ROADMAP.md` y `PROXIMOS_PASOS.md` (historia en git).
> Última actualización: 2026-06-11.

## Qué es EdificIA (visión canónica)

EdificIA es el **sistema operativo de una empresa constructora**, con un agente de IA que actúa como **Project Manager Digital continuo**: entiende obras, documentos, presupuestos, riesgos y decisiones, y deja cada decisión conectada con evidencia.

- El chat es **una interfaz, no el centro** del producto.
- El centro es el modelo `Empresa → Obra → Expediente Operativo → Eventos/Evidencias/Acciones/Artefactos`.
- La **auditoría documental es una capacidad** del agente (se activa cuando llega un documento o se la piden) — **no es su identidad**. La identidad es la gestión operativa: estado de obra, cronograma, HSE, clima, finanzas (curva S), acopios, subcontratos, comunicación y generación de artefactos con trazabilidad.
- Las tools son instrumentos, no el razonamiento. El agente lee, forma hipótesis, contrasta con contexto de empresa/obra, verifica con tools y sintetiza hechos/riesgos/acciones.

Detalle de visión: `EXPLICACION_PROYECTO_PARA_VOS.md` · dominio: `03_domain_knowledge.md` · contexto empresarial: `06_enterprise_context_layer.md` · lectura agéntica: `07_agentic_document_reading.md` · modelo de expedientes: `08_agent_core_redesign.md`.

## Estado actual del sistema (2026-06-11)

- **Infraestructura 100% propia** (desconexión de InsForge/Qdrant completada): PostgreSQL 16 + pgvector, auth local (JWT HS256 + refresh con rotación), storage filesystem, runner de migraciones propio. Únicos externos: DeepSeek (LLM) y NVIDIA NIM (embeddings).
- **Agente con dos backends**: runtime TS embebido (default) y **cerebro Python** (`services/agent/`, FastAPI) detrás de `AGENT_BACKEND=python`, con tool gateway (`/api/internal/tools/*`). Ambos consumen el mismo prompt compuesto.
- **Aprendizaje real**: `agent_memories` (embedding + scope + confianza) con reflexión LLM post-turno, feedback explícito (`agent_feedback`) y decay/refuerzo. Retrieval semántico inyectado al prompt.
- **Identidad del agente re-centrada** (plan `10_plan_agente_especializado.md`): prompt modular por capacidades, apertura operativa, modos con tools filtradas, evals de conducta.
- Operación local: `colima start` → `docker compose up -d postgres` → `npm run migrate` → `npm run dev` (+ opcional `services/agent` con uvicorn). Apagar todo: `colima stop`.

## Pendientes vigentes

### Producto / agente
- Migrar tools TS → Python de a una (el gateway lo permite gradual).
- Deprecar `company_learned_patterns` cuando `agent_memories` cubra sus usos (perfil empresarial sigue leyéndose como contexto).
- UI de feedback más rica: rating positivo y corrección inline (hoy: botón "respuesta incorrecta" + persistencia).
- Conectar Expedientes al flujo de usuario como contenedor primario (el chat como canal del expediente — visión 08).

### Calidad
- Tests de integración auth + multi-tenancy (que una org no pueda ver datos de otra: `requireAuth`, una ruta con orgId, RLS).
- Revisar suppressions `exhaustive-deps` en `chat/page.tsx` (riesgo de stale-closure en el stream).
- Deuda menor: `UNIQUE(organization_id, user_id)` en members es completo, no parcial por `deleted_at` (re-invitar a un miembro soft-deleted falla).

### Decisiones de producto abiertas
- **Inteligencia Empresarial**: hacer UN conector real read-only end-to-end (ej. Drive OAuth) o bajar la narrativa a lo que hace hoy (`manual_upload`). No dejar fachada.
- **Motor de proactividad**: desplegar el schedule (requiere URL pública + `CRON_SECRET`) o marcarlo congelado.
- Inventario de features dormidas: para cada una, activar / simplificar / borrar.

### Externos (bloqueados por terceros)
- URL pública + deployment estable.
- Conectores reales (Drive/SharePoint/SQL/ERPs): requieren OAuth + credenciales del cliente.
- Infraestructura definitiva para el servicio Python (es portable: Postgres + env vars).

## Backlog especulativo (no comprometido)

Ver `05_future_roadmap.md` (DWG nativo, OCR, BIM/IFC, cómputo automático). Nada de eso está planificado.
