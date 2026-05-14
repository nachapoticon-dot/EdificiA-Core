# Plan de Mejora y Despliegue: EdificIA

> **Última auditoría de estado**: 2026-05-14 (verificado contra código fuente)
> 
> Leyenda: ✅ = Hecho y verificado | 🔶 = Parcial (ver detalles) | ❌ = Pendiente | 🐛 = Bug/Error detectado

Este documento sirve como hoja de ruta para las próximas implementaciones en el proyecto EdificIA. Está formateado para que asistentes como Claude Code puedan leerlo y ejecutar los pasos de forma secuencial.

---

## 1. Montaje y Dockerización (Servidor y Servicios)
**Objetivo:** Contenerizar la aplicación para facilitar su despliegue en cualquier servidor (VPS, AWS, etc.) y unificar el entorno de desarrollo.

- ✅ **Paso 1: Dockerfile para Next.js**
  - `Dockerfile` creado en raíz, modo `standalone`.
- 🔶 **Paso 2: Orquestación con Docker Compose (`docker-compose.yml`)**
  - ✅ Servicio `web` (Next.js) definido.
  - ✅ Servicio `qdrant` definido con volumen persistente.
  - ✅ Servicio `postgres` definido con volumen (disponible para modo self-hosted futuro).
- 🐛 **Paso 3: Dockerfile no pasa variables NEXT_PUBLIC en build-time**
  - Las variables `NEXT_PUBLIC_INSFORGE_URL` y `NEXT_PUBLIC_APP_URL` se necesitan en build-time para que Next.js las compile en el bundle del cliente. El Dockerfile actual no las recibe como `ARG`.
  - **TAREA**: Agregar en el Dockerfile, antes del `RUN npm run build`:
    ```dockerfile
    ARG NEXT_PUBLIC_INSFORGE_URL
    ARG NEXT_PUBLIC_APP_URL
    ENV NEXT_PUBLIC_INSFORGE_URL=$NEXT_PUBLIC_INSFORGE_URL
    ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
    ```
- ✅ **Paso 4: Variables de entorno**
  - `.env.docker.example` creado con todas las variables necesarias.
  - `.env.local` existe y está en `.gitignore` (NO trackeado en git ✅).

---

## 2. Persistencia por Base de Datos
**Objetivo:** Asegurar que los datos relacionales y vectoriales no se pierdan al reiniciar.

- ✅ **Paso 1: Configuración de Volúmenes Docker**
  - Volúmenes `qdrant_data` y `postgres_data` configurados en `docker-compose.yml`.
- ✅ **Paso 2: Migraciones Automáticas**
  - ✅ 14 migraciones en `db/migrations/` (001-014) + 3 en `migrations/` (InsForge CLI).
  - ✅ Script `scripts/migrate.js` con tabla `_migrations` para tracking de aplicación.
  - ✅ `CMD` en `Dockerfile`: `node scripts/migrate.js 2>/dev/null || true && node server.js`.

---

## 3. Monitoreo del Estado de los Servicios
**Objetivo:** Visibilidad en tiempo real de si los servicios están operativos.

- ✅ **Paso 1: Endpoint de Health Check (`/api/health`)**
  - Ruta creada, hace ping a PostgreSQL y Qdrant. Retorna latencia por servicio.
- ✅ **Paso 2: Docker Healthchecks**
  - ✅ Healthcheck de Qdrant: `wget healthz`.
  - ✅ Healthcheck del servicio web: `wget -qO- http://localhost:3000/api/health`.

---

## 4. Conexión y Consistencia Frontend-Backend
**Objetivo:** Comunicación robusta y segura en el monorepo.

- ✅ **Paso 1: Validación E2E**
  - Schemas Zod en `src/lib/validators/index.ts` (loginSchema, signUpSchema, createTenantSchema).
  - API routes validan con Zod.
- ✅ **Paso 2: Manejo de errores global**
  - `src/lib/api/errors.ts` con 7 helpers estandarizados (apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound, apiTooLarge, apiRateLimited, apiInternal).
  - Rate limiter en `src/lib/api/rate-limit.ts` con 4 presets (standard, chat, upload, auth).
- 🐛 **Paso 3: Falta getAuthHeaders unificado**
  - Hay 4 patrones distintos para obtener el header Authorization en el frontend. Cada hook/página tiene su propia implementación.
  - **TAREA**: Crear una función centralizada `getAuthHeaders()` en `src/lib/insforge/client.ts` que use `getAuthToken()` (con refresh automático) y retorne `{ Authorization: "Bearer ..." }`. Reemplazar en: `useOrgMember.ts`, `useOrgs.ts`, `useProjects.ts`, `documents/page.tsx`, `admin/page.tsx`.

---

## 5. Mejora en la Información y Base de Datos (RAG)
**Objetivo:** El agente debe recibir mejor contexto y metadatos.

- ✅ **Paso 1: Enriquecimiento de Metadatos**
  - Al procesar archivos se guardan metadatos en Qdrant (tipo, org, proyecto).
  - Tabla `document_chunks` con `organization_id`, `project_id`, `file_id`.
- ✅ **Paso 2: Pre-procesamiento Inteligente**
  - `file-processor` maneja Excel, PDF, DXF, DOCX, imágenes.
  - Excel se formatea como tabla estructurada con items.
  - DXF extrae capas, bloques, entidades, geometría.
- ✅ **Paso 3: Búsqueda Híbrida (semántica + FTS)**
  - `src/lib/rag/search.ts`: semántica (Qdrant) + PostgreSQL FTS (`tsquery spanish`) + ilike fallback.
  - Merge por score: semántica preferida, FTS re-scored × 0.7 para completar slots.
  - Intent detection por query para filtrar por doc_type relevante.

---

## 6. Mejora de Interfaz y System Prompt
**Objetivo:** Subida de archivos intuitiva y agente con reglas estrictas.

- ✅ **Paso 1: UI de Subida (Estética)**
  - ✅ DropZone con drag & drop + Framer Motion (`src/components/chat/DropZone.tsx`).
  - ✅ FileCard con metadatos reales (`src/components/chat/FileCard.tsx`).
  - ✅ `UploadProgressCard`: barra animada con etapas mientras el POST está en vuelo.
- ✅ **Paso 2: Refinamiento del System Prompt**
  - System prompt en `src/lib/ai/agent-prompt.ts` (198 líneas) con flujo obligatorio.
  - Incluye patrones aprendidos por empresa, sesiones recientes, proyecto activo.
  - ✅ Reglas de generación: STOP tras herramientas de doc, no llamar buscar antes de generar.
- ✅ **Paso 3 (extra): Corrección de procesadores de archivos**
  - `pdf-processor.ts`: fallback `estimatePageCountFromBytes()` (cuenta `/Type /Page` excluyendo `/Pages`).
  - `agent-tools-bound.ts`: guard de caché nulo en `generar_presupuesto_excel`.
- ✅ **Paso 4 (extra): UI Generativa activada**
  - 4 bloques: MetricsBlock, ComparisonBlock, TimelineBlock, MediaBlock.
  - Conectadas en `createBoundTools()` y `SPECIAL_TOOLS` de `MessageBubble.tsx`.

---

## 7. Seguridad y Resiliencia en Producción
**Objetivo:** App segura, robusta y escalable para entornos empresariales.

- 🔶 **Paso 1: Aislamiento y Control de Acceso**
  - ✅ Multi-tenancy: Todas las queries filtran por `organization_id` derivado del token del usuario.
  - 🐛 **CORS ROTO en `next.config.ts`**: Usa `ALLOWED_ORIGINS.join(",")` para el header `Access-Control-Allow-Origin`, pero la spec HTTP **no permite múltiples orígenes** separados por coma. Solo acepta UN origin o `*`. En producción con múltiples dominios esto se ignora silenciosamente.
    - **TAREA**: Reemplazar con un middleware dinámico que lea `req.headers.origin`, lo valide contra la lista de `ALLOWED_ORIGINS`, y devuelva solo ese origin en el header.
  - ✅ Password Reset seguro: HMAC-SHA256 token (1h TTL) · `POST /api/auth/forgot-password` · `PUT /api/auth/reset-password` · páginas `/forgot-password` + `/reset-password` · email vía Resend.
- 🔶 **Paso 2: Protección contra Ataques**
  - ✅ Input Validation con Zod en todas las API routes.
  - 🔶 Rate Limiting parcial: chat ✅, upload ✅, projects ✅. Pero **login NO tiene** porque el login se hace directo al SDK de InsForge desde el browser sin pasar por ninguna API route del servidor. Ver Plan de Login.
- 🔶 **Paso 3: Optimización y Manejo de Errores**
  - ✅ Error handling estandarizado con `src/lib/api/errors.ts`.
  - ✅ Índices de DB creados en migraciones 003, 005.
  - ❌ Performance profiling bajo carga real.
  - 🐛 **Falta error pages de Next.js**: No existen `error.tsx`, `loading.tsx`, ni `not-found.tsx` en ningún nivel del app router. Si algo falla, el usuario ve pantalla blanca.
    - **TAREA**: Crear `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/dashboard/error.tsx`, `src/app/dashboard/loading.tsx`.
- 🔶 **Paso 4: Observabilidad y Recuperación**
  - ✅ Logger con Pino creado (`src/lib/logger.ts`) con child loggers (http, auth, ai, rag, db).
  - 🐛 **El logger no se usa en todas las rutas**: Muchas API routes usan `console.error` en lugar de los loggers de Pino. `upload/route.ts` tiene `catch {}` vacíos que silencian errores.
    - **TAREA**: Reemplazar `console.error` por el logger correspondiente en todas las API routes.
  - ❌ Sistema de alertas (Sentry, etc.).
  - ❌ WAL verification en PostgreSQL.
  - ❌ Estrategia de rollback automatizada.

### 🔶 Auth (2026-05-14) — Funciona pero con debilidades de seguridad
> - ✅ `src/middleware.ts` protege `/dashboard/*` → redirect a `/login`.
> - ✅ `verifyUserId()` verifica JWT con InsForge server-side + cache de 60 s.
> - 🐛 **`verifyUserId` tiene fallback peligroso**: Si InsForge no responde (caído, timeout, error), acepta el JWT sin verificar firma. Un token fabricado sería aceptado. Aceptable para dev, **peligroso en producción**.
>   - **TAREA**: En producción, si InsForge no responde, retornar `null` (rechazar) en vez del fallback decode-only. Agregar variable de entorno `AUTH_STRICT_MODE=true` para controlar este comportamiento.
> - ✅ `requireAuth()` centralizado — 18 route handlers refactorizadas.
> - 🐛 **Cookie `edificia_session` NO es httpOnly**: Se setea con `document.cookie` desde el frontend. Cualquier XSS la puede leer.
>   - **TAREA**: Ver `PLAN_LOGIN_FRONTEND_BACKEND.md` — crear `POST /api/auth/login` que setee la cookie como httpOnly desde el servidor.
> - 🔶 Logout limpia `edificia_session` ✅, pero también intenta borrar cookies `sb-*` e `insforge_csrf_token` que nunca se setean (código muerto).
>   - **TAREA**: Limpiar el código de logout para que solo borre lo relevante.

### ✅ Password Reset — Implementado
> Ya está completo: `forgot-password/route.ts` + `reset-password/route.ts` + HMAC token + email vía Resend + páginas frontend.

### ❌ Pendiente en Auth
> - Cookie httpOnly (requeriría crear `POST /api/auth/login`). Ver `PLAN_LOGIN_FRONTEND_BACKEND.md`.
> - Interceptor global de 401 para redirigir a `/login` cuando el token expira.
> - `AUTH_STRICT_MODE` para no aceptar JWTs sin verificar firma en producción.

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

---

## 9. UX y Responsive (NUEVO — detectado en auditoría 2026-05-14)
**Objetivo:** Interfaz usable en mobile y experiencia fluida.

- ❌ **Paso 1: Dashboard responsive**
  - El sidebar es fijo `w-60` (240px) sin breakpoints. En mobile ocupa toda la pantalla.
  - **TAREA**: Sidebar colapsable con botón hamburguesa en mobile. Overlay/drawer. Breakpoint `md:` como punto de quiebre. Guardar preferencia en localStorage.
  - **Archivos**: `src/app/dashboard/layout.tsx`
- ❌ **Paso 2: Indicador de ruta activa en sidebar**
  - Los links del sidebar no muestran cuál está activo. El usuario no sabe en qué página está.
  - **TAREA**: Usar `usePathname()` y aplicar clases de highlight al link activo.
  - **Archivo**: `src/app/dashboard/layout.tsx`
- ❌ **Paso 3: Confirmación en acciones destructivas**
  - Borrar documentos (`documents/page.tsx`) y revocar miembros (`admin/page.tsx`) no piden confirmación.
  - **TAREA**: Agregar modal "¿Estás seguro?" en todas las acciones de borrado.
- 🐛 **Paso 4: Botón de búsqueda decorativo**
  - El ícono `<Search>` en el sidebar no tiene `onClick` ni funcionalidad.
  - **TAREA**: Conectarlo a un modal de búsqueda global, o quitarlo hasta que esté implementado.
- 🐛 **Paso 5: Ruta `/dashboard/blocks-demo` expuesta en producción**
  - Es una página de debug/desarrollo accesible para cualquier usuario autenticado.
  - **TAREA**: Protegerla con `if (process.env.NODE_ENV !== "development") notFound()` o mover fuera del router.
- ❌ **Paso 6: Auto-redirect cuando el token expira**
  - Cuando `getAuthToken()` falla el refresh, el usuario se queda en el dashboard con llamadas que retornan 401 silenciosamente. No hay redirect automático a login.
  - **TAREA**: Interceptor global (en un Provider o en `getAuthHeaders`) que detecte 401 y limpie estado + redirija a `/login`.
