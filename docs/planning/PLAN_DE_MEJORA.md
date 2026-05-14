# Plan de Mejora y Despliegue: EdificIA

> **Última auditoría de estado**: 2026-05-14
> 
> Leyenda: ✅ = Hecho | 🔶 = Parcial | ❌ = Pendiente

Este documento sirve como hoja de ruta para las próximas implementaciones en el proyecto EdificIA. Está formateado para que asistentes como Claude Code puedan leerlo y ejecutar los pasos de forma secuencial.

---

## 1. Montaje y Dockerización (Servidor y Servicios)
**Objetivo:** Contenerizar la aplicación para facilitar su despliegue en cualquier servidor (VPS, AWS, etc.) y unificar el entorno de desarrollo.

- ✅ **Paso 1: Dockerfile para Next.js**
  - `Dockerfile` creado en raíz, modo `standalone`.
- 🔶 **Paso 2: Orquestación con Docker Compose (`docker-compose.yml`)**
  - ✅ Servicio `web` (Next.js) definido.
  - ✅ Servicio `qdrant` definido con volumen persistente.
  - ❌ Servicio `postgres` local para desarrollo sin InsForge.
- ✅ **Paso 3: Variables de entorno**
  - `.env.local.example` y `.env.docker.example` creados.

---

## 2. Persistencia por Base de Datos
**Objetivo:** Asegurar que los datos relacionales y vectoriales no se pierdan al reiniciar.

- ✅ **Paso 1: Configuración de Volúmenes Docker**
  - Volúmenes configurados en `docker-compose.yml`.
- ✅ **Paso 2: Migraciones Automáticas**
  - ✅ 14 migraciones en `db/migrations/` + 3 en `migrations/` (InsForge CLI).
  - ✅ Script `scripts/migrate.js` creado.
  - ✅ `CMD` en `Dockerfile`: `node scripts/migrate.js || true && node server.js`.

---

## 3. Monitoreo del Estado de los Servicios
**Objetivo:** Visibilidad en tiempo real de si los servicios están operativos.

- ✅ **Paso 1: Endpoint de Health Check (`/api/health`)**
  - Ruta creada, hace ping a PostgreSQL y Qdrant.
- ✅ **Paso 2: Docker Healthchecks**
  - ✅ Healthcheck de Qdrant en docker-compose.
  - ✅ Healthcheck del servicio web: `wget -qO- http://localhost:3000/api/health`.

---

## 4. Conexión y Consistencia Frontend-Backend
**Objetivo:** Comunicación robusta y segura en el monorepo.

- ✅ **Paso 1: Validación E2E**
  - Schemas Zod en `src/lib/validators/index.ts` (login, signUp, tenant).
  - API routes validan con Zod.
- ✅ **Paso 2: Manejo de errores global**
  - `src/lib/api/errors.ts` con helpers estandarizados (apiUnauthorized, apiForbidden, etc.).
  - Rate limiter en `src/lib/api/rate-limit.ts`.

---

## 5. Mejora en la Información y Base de Datos (RAG)
**Objetivo:** El agente debe recibir mejor contexto y metadatos.

- ✅ **Paso 1: Enriquecimiento de Metadatos**
  - Al procesar archivos se guardan metadatos en Qdrant (tipo, org, proyecto).
  - Tabla `document_chunks` con `organization_id`, `project_id`, `file_id`.
- ✅ **Paso 2: Pre-procesamiento Inteligente**
  - `file-processor` maneja Excel, PDF, DXF, DOCX, imágenes.
  - Excel se formatea como tabla estructurada con items.
  - DXF extrae capas, bloques, entidades.
- ✅ **Paso 3: Búsqueda Híbrida (semántica + FTS)**
  - `src/lib/rag/search.ts`: semántica (Qdrant) + PostgreSQL FTS (`tsquery spanish`) + ilike fallback.
  - Merge por score: semántica preferida, FTS re-scored × 0.7 para completar slots.

---

## 6. Mejora de Interfaz y System Prompt
**Objetivo:** Subida de archivos intuitiva y agente con reglas estrictas.

- ✅ **Paso 1: UI de Subida (Estética)**
  - ✅ DropZone con drag & drop + Framer Motion (`src/components/chat/DropZone.tsx`).
  - ✅ FileCard con metadatos reales (`src/components/chat/FileCard.tsx`).
  - ✅ `UploadProgressCard`: barra animada con etapas (Subiendo → Procesando → Indexando) mientras el POST está en vuelo.
- ✅ **Paso 2: Refinamiento del System Prompt**
  - System prompt en `src/lib/ai/agent-prompt.ts` con flujo obligatorio.
  - Incluye patrones aprendidos por empresa, sesiones recientes, proyecto activo.
  - ✅ Reglas de generación: STOP tras herramientas de doc, no llamar buscar antes de generar.
- ✅ **Paso 3 (extra): Corrección de procesadores de archivos**
  - `pdf-processor.ts`: fallback `estimatePageCountFromBytes()` cuando `pdf-parse` lanza excepción.
  - `agent-tools-bound.ts`: guard de caché nulo en `generar_presupuesto_excel`.
- ✅ **Paso 4 (extra): UI Generativa activada**
  - `proyectar_metricas`, `proyectar_comparativa`, `proyectar_cronograma`, `proyectar_legajo_grafico` conectadas en `createBoundTools()`.
  - `SPECIAL_TOOLS` actualizado en `MessageBubble.tsx`.

---

## 7. Seguridad y Resiliencia en Producción
**Objetivo:** App segura, robusta y escalable para entornos empresariales.

- ✅ **Paso 1: Aislamiento y Control de Acceso**
  - ✅ Multi-tenancy: Todas las queries filtran por `organization_id` derivado del token del usuario. RLS en DB.
  - ✅ CORS configurado en `next.config.ts` (headers restrictivos).
  - ✅ Password Reset seguro: HMAC-SHA256 token (1h TTL) · `POST /api/auth/forgot-password` · `PUT /api/auth/reset-password` · páginas `/forgot-password` + `/reset-password` · email vía Resend.
- ✅ **Paso 2: Protección contra Ataques**
  - ✅ Input Validation con Zod en todas las API routes.
  - ✅ Rate Limiting en endpoints críticos (auth, chat, upload).
- 🔶 **Paso 3: Optimización y Manejo de Errores**
  - ✅ Error handling estandarizado con `src/lib/api/errors.ts`.
  - ✅ Índices de DB creados en migraciones 003, 005.
  - ❌ Performance profiling bajo carga real.
- 🔶 **Paso 4: Observabilidad y Recuperación**
  - ✅ Logger con Pino creado (`src/lib/logger.ts`).
  - ❌ Sistema de alertas (Sentry, etc.).
  - ❌ WAL verification en PostgreSQL.
  - ❌ Estrategia de rollback automatizada.

### ✅ Auth arreglada (2026-05-14)
> - `src/middleware.ts` real protege `/dashboard/*` → redirect a `/login`.
> - `verifyUserId()` verifica JWT con InsForge server-side + cache de 60 s.
> - `requireAuth()` centralizado — 18 route handlers refactorizadas.
> - Token en `localStorage` + cookie `edificia_session` (7 días).
> - Logout limpia localStorage + cookie del servidor.

### ❌ Pendiente en Auth
> - Password reset seguro.
> - Cookie httpOnly (requeriría arquitectura de refresh token separada).

---

## 8. Funciones Proactivas y Gestión Integral de Obra
**Objetivo:** Evolucionar de auditor reactivo a "Project Manager de Obra Digital".

- ❌ **Paso 1: Arquitectura de Datos Extendida para la Obra Real**
  - Cronograma y finanzas.
  - Directorio y subcontratos.
  - HSE (seguridad laboral).
  - Acopios y suministros.
- ❌ **Paso 2: Motor de Proactividad y Clima**
  - CRON jobs / Workers para análisis diario.
  - Integración meteorológica.
  - Alertas preventivas (seguros, materiales).
- ❌ **Paso 3: Tools Avanzadas para el Agente IA**
  - `evaluar_impacto_clima(fecha)`
  - `verificar_ingreso_personal(cuadrilla)`
  - `reprogramar_e_informar(tarea, fecha)`
  - `auditar_curva_inversion()`
