# Tareas Pendientes para Claude

> **Última auditoría de estado**: 2026-05-14 (verificado contra código fuente)
> 
> Leyenda: ✅ = Hecho y verificado | 🔶 = Parcial (ver detalles) | ❌ = Pendiente | 🐛 = Bug detectado

Este documento recopila los errores encontrados y las nuevas características o mejoras que deben ser implementadas en el proyecto. 

---

## 🐛 Errores Corregidos (verificados)

- ✅ **Error al generar Excel** — Corregido (2026-05-14):
  - Guard en `generar_presupuesto_excel`: si `cacheId` expiró → error explícito en lugar de propuesta con 0 ítems.
  - Guard adicional: si no hay `cacheId` ni `items` → error explícito.
  - System prompt actualizado: regla estricta de STOP tras llamar herramientas de generación + instrucción de no llamar `buscar_en_base_documental` antes de generar.

- ✅ **PDF con 0 páginas y OCR falso** — Corregido (2026-05-14):
  - Cuando `pdf-parse` lanza excepción (PDF/A, encoding, seguridad), `pageCount` ya no es 0.
  - `estimatePageCountFromBytes()`: cuenta `/Type /Page` en raw bytes (sin confundir con `/Type /Pages`).
  - `isScanned: true` se mantiene correcto (texto no extraíble = tratar como escaneado).

- ✅ **Auth rota (CRÍTICO)** — Corregido:
  - `src/middleware.ts` protege `/dashboard/*`, redirige a `/login`.
  - `verifyUserId()` verifica JWT contra InsForge server-side (cache 60 s).
  - `requireAuth()` centralizado en `src/lib/auth/require-auth.ts` — 18 routes refactorizadas.
  - `/api/chat` y `/api/upload` requieren auth estricta (sin fallbacks).
  - Token en `localStorage` + cookie `edificia_session` (7 días), logout limpia ambos.

---

## 🐛 Errores corregidos — 2026-05-14 (sesión 2, verificados)

- ✅ **BUG-2 Chat UNAUTHORIZED** — `jwt.ts` cae a fallback decode-only en non-ok de InsForge. `client.ts` agrega `getAuthToken()` con refresh automático + persiste `refreshToken`. `chat/page.tsx` usa `getAuthToken()`.
- ✅ **BUG-1 POST /api/projects error genérico** — ahora retorna el `code` y `message` real de DB en el response JSON.
- ✅ **BUG-3 org deshabilitada sigue con acceso** — `requireAuth` hace segundo query a `organizations` verificando `deleted_at IS NULL`.

---

## 🐛 Bugs ACTIVOS (encontrados en auditoría 2026-05-14)

- 🐛 **BUG-4 CORS multi-origin roto** — `next.config.ts` usa `ALLOWED_ORIGINS.join(",")`. La spec HTTP no permite múltiples orígenes. Solo funciona si hay UN solo origin configurado.
  - **TAREA**: Crear middleware dinámico que valide `req.headers.origin` contra la lista y devuelva solo ese origin. Ver `PLAN_DE_MEJORA.md` §7.1.
  - **Archivo**: `next.config.ts` (cambiar) + posiblemente `src/middleware.ts` (agregar lógica CORS).

- 🐛 **BUG-5 Viewer puede crear obras** — `POST /api/projects` no tiene guard de viewer. Cualquier usuario con rol "viewer" puede crear proyectos.
  - **TAREA**: Agregar `if (auth.role === "viewer") return apiForbidden("Los visualizadores no pueden crear obras.")` en `POST /api/projects`.
  - **Archivo**: `src/app/api/projects/route.ts` (función POST, después de `requireAuth`).

- 🐛 **BUG-6 Viewer puede borrar archivos por ruta dinámica** — `DELETE /api/documents/[id]` no verifica el rol. La ruta `DELETE /api/documents` (con query param) SÍ exige admin, pero son dos endpoints distintos.
  - **TAREA**: Agregar guard de viewer (o exigir admin) en `DELETE /api/documents/[id]`.
  - **Archivo**: `src/app/api/documents/[id]/route.ts` (función DELETE, después de `requireAuth`).

- 🐛 **BUG-7 verifyUserId acepta tokens sin firma verificada** — Si InsForge no responde (timeout, 500, etc.), el fallback acepta el JWT solo con decode local. Un token fabricado con firma falsa sería aceptado.
  - **TAREA**: Agregar variable `AUTH_STRICT_MODE`. Si está activada, no hacer fallback decode-only y retornar `null`. Para producción.
  - **Archivo**: `src/lib/auth/jwt.ts` (función `verifyUserId`, línea ~76).

- 🐛 **BUG-8 Cookie de sesión no es httpOnly** — `edificia_session` se setea con `document.cookie` desde el frontend. Vulnerable a XSS.
  - **TAREA**: Ver `PLAN_LOGIN_FRONTEND_BACKEND.md` completo. Crear `POST /api/auth/login` que setee cookie httpOnly desde el servidor.
  - **Archivos**: Crear `src/app/api/auth/login/route.ts`, modificar `src/app/(auth)/login/page.tsx`, modificar `src/lib/insforge/client.ts`.

- 🐛 **BUG-9 Logout limpia cookies que nunca se setean** — El `POST /api/auth/logout` intenta borrar cookies `sb-*` e `insforge_csrf_token` que el login nunca setea. Código muerto que confunde.
  - **TAREA**: Limpiar el logout para que solo borre `edificia_session` y las cookies que realmente existen.
  - **Archivo**: `src/app/api/auth/logout/route.ts`.

- 🐛 **BUG-10 Dockerfile no pasa NEXT_PUBLIC en build-time** — Las variables `NEXT_PUBLIC_*` no se pasan como `ARG` al build de Docker. El bundle del cliente no las incluye.
  - **TAREA**: Agregar `ARG NEXT_PUBLIC_INSFORGE_URL` y `ARG NEXT_PUBLIC_APP_URL` + los correspondientes `ENV` antes del `RUN npm run build`.
  - **Archivo**: `Dockerfile` (en la stage `builder`, antes de línea 12).

---

## ✨ Mejoras Completadas (verificadas)

- ✅ **Selector/Card de Organización Dinámico**
  - Componente `OrganizationCard.tsx` creado y conectado en el sidebar.
  - Datos dinámicos desde `/api/auth/me`.

- ✅ **Tarjeta de Obra Activa**
  - Componente `ActiveProjectSection.tsx` en el sidebar.
  - Hooks `useProjectDetails.ts` y `useProjectCoverage.ts` para datos dinámicos.

- 🔶 **Íconos de Acción (Búsqueda y Configuración)**
  - ✅ Ícono de Configuración → link a `/dashboard/admin/settings`, funcional.
  - 🐛 Ícono de Búsqueda → **no tiene onClick, es decorativo**. Sin funcionalidad.
    - **TAREA**: Conectar a un modal de búsqueda global o quitar hasta implementar.
    - **Archivo**: `src/app/dashboard/layout.tsx` (línea ~35).

- ✅ **Rediseño de Tarjetas de Documentos Subidos**
  - Componente `FileCard.tsx` con ícono según tipo, nombre, metadatos reales, modo claro/oscuro.

- ✅ **Componentes de UI Generativa (4 bloques)** — Activados (2026-05-14):
  - `proyectar_metricas`, `proyectar_comparativa`, `proyectar_cronograma`, `proyectar_legajo_grafico` conectadas en `createBoundTools()`.
  - 4 bloques visuales en `src/components/chat/blocks/`.

- ✅ **Panel SuperAdmin y Seguridad de Datos**
  - Panel completo en `/super-admin` con auth propia (SUPER_ADMIN_KEY).
  - 3 tabs: Fundadores, Empresas, Estadísticas.
  - API routes funcionales para gestión de invitaciones y empresas.

- ✅ **Super Admin — Re-activar invitaciones** — `PATCH /api/super-admin/founders` resetea token + 30 días.
- ✅ **Super Admin — Agregar miembro a empresa** — `POST /api/super-admin/members` crea invitación + email.

---

## ❌ Tareas Nuevas (detectadas en auditoría 2026-05-14)

- ❌ **Error pages de Next.js** — No existen `error.tsx`, `loading.tsx`, ni `not-found.tsx`. El usuario ve pantalla blanca si algo falla.
  - **TAREA**: Crear `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/dashboard/error.tsx`, `src/app/dashboard/loading.tsx` con diseño coherente al sistema.

- ❌ **Dashboard no responsive** — El sidebar es fijo 240px sin breakpoints. Inutilizable en mobile.
  - **TAREA**: Sidebar colapsable con hamburguesa en mobile, overlay drawer, breakpoint `md:`.
  - **Archivo**: `src/app/dashboard/layout.tsx`.

- ❌ **Sin indicador de ruta activa en sidebar** — Los links de nav no muestran cuál está activo.
  - **TAREA**: Usar `usePathname()` y aplicar clase de highlight al link activo.
  - **Archivo**: `src/app/dashboard/layout.tsx` (convertir los `<Link>` a un componente NavLink con estado).

- ❌ **Sin confirmación al borrar** — Borrar documentos y revocar miembros se ejecutan inmediatamente sin confirmar.
  - **TAREA**: Agregar modal de confirmación en `documents/page.tsx` y `admin/page.tsx`.

- ❌ **`/dashboard/blocks-demo` expuesto en producción** — Ruta de debug accesible.
  - **TAREA**: Agregar `if (process.env.NODE_ENV !== "development") notFound()` al inicio del componente.
  - **Archivo**: `src/app/dashboard/blocks-demo/page.tsx`.

- ❌ **Auto-redirect en 401** — Cuando el token expira, las llamadas fallan silenciosamente sin redirigir a login.
  - **TAREA**: Interceptor global en un Provider que detecte 401 y redirija a `/login`.

- ❌ **Código muerto: `useCurrentUser.ts`** — Hook que no se usa en ningún componente.
  - **TAREA**: Borrar `src/hooks/useCurrentUser.ts`.

- ❌ **Código duplicado: `slugify()`** — Función idéntica copiada en `register/route.ts` y `claim-founder/route.ts`.
  - **TAREA**: Extraer a `src/lib/utils.ts` e importar desde ambos.

- ❌ **Unificar `getAuthHeaders()` en frontend** — 4 patrones distintos en hooks y páginas.
  - **TAREA**: Función centralizada en `src/lib/insforge/client.ts`. Ver `PLAN_DE_MEJORA.md` §4.3.

- ❌ **Directorio `src/types/` vacío** — Los tipos se definen inline en cada archivo.
  - **TAREA**: Centralizar interfaces compartidas (`OrgMember`, `Project`, `DocumentFile`, etc.).

- ❌ **Logger no usado consistentemente** — Muchas rutas usan `console.error` en lugar de Pino.
  - **TAREA**: Reemplazar `console.error` por `httpLogger`/`dbLogger` en todas las API routes.

---

## 📋 Resumen rápido

| Feature | Estado |
|---------|--------|
| OrganizationCard dinámico | ✅ |
| Tarjeta de Obra Activa | ✅ |
| Ícono Config → link funcional | ✅ |
| Ícono Búsqueda → funcional | 🐛 No tiene onClick |
| FileCard con metadatos reales | ✅ |
| Panel SuperAdmin | ✅ |
| UI Generativa (4 bloques) | ✅ |
| Fix error Excel gen | ✅ |
| Fix PDF 0 páginas / isScanned falso | ✅ |
| Fix Auth completo | 🔶 Funciona pero cookie no httpOnly |
| Fix Chat UNAUTHORIZED (token refresh) | ✅ |
| Fix org deshabilitada sin efecto | ✅ |
| Super Admin — re-activar invitaciones | ✅ |
| Super Admin — agregar miembro a empresa | ✅ |
| CORS multi-origin | 🐛 Roto |
| Viewer puede crear obras | 🐛 Sin guard |
| Viewer puede borrar archivos (ruta [id]) | 🐛 Sin guard |
| JWT fallback acepta tokens sin firma | 🐛 Peligroso en prod |
| Dockerfile no pasa NEXT_PUBLIC vars | 🐛 Bundle sin env vars |
| Error pages de Next.js | ❌ Faltan |
| Dashboard responsive | ❌ No existe |
| Ruta activa en sidebar | ❌ Falta |
