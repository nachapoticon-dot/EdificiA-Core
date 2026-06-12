# EdificIA — Contexto para Claude Code

EdificIA es un **Sistema de Operaciones Autónomo para la Construcción**. El agente IA actúa como *Project Manager Digital* para constructoras argentinas. Multi-tenant estricto.

---

## 1 · Comportamiento del agente

### Flujo de trabajo obligatorio

1. **Leer antes de actuar.** Antes de proponer o escribir código, leer los archivos involucrados. No asumir contenido.
2. **Verificar tareas activas.** Antes de trabajar sobre el producto (features, arquitectura, prioridades), leer `docs/00_PRODUCTO.md` (visión, estado y pendientes vigentes). No es necesario para consultas puntuales o fixes acotados.
3. **Preguntar ante ambigüedad.** Si una instrucción admite más de una interpretación, preguntar. No inventar requerimientos.
4. **Un cambio, un propósito.** Cada edición debe resolver exactamente lo que se pidió. No refactorizar "de paso", no mejorar nombres, no reordenar imports, a menos que se pida explícitamente.
5. **Probar lo que se toca.** Después de cada cambio, verificar que compila (`npm run type-check`) si es un cambio de tipos, o validar lógica si es runtime. Reportar resultado.

### Comunicación

- Responder en **español** (el idioma del equipo).
- Ser directo. Ir al punto sin rodeos ni explicaciones innecesarias.
- Al terminar una tarea, dar un resumen breve: qué se hizo, qué archivos se tocaron, y si quedó algo pendiente.
- No repetir contexto que ya se dio. Si el usuario ya explicó algo, no parafrasearlo de vuelta.

### Coordinación entre agentes

- Este archivo (`CLAUDE.md`) es la **única guía operativa canónica**. Si otro agente necesita guía, debe leer este archivo; no mantener copias paralelas.
- No existe worklog entre agentes: el handoff es el historial de git (commits descriptivos) y los pendientes en `docs/00_PRODUCTO.md`.

### Toma de decisiones

- **Priorizar lo simple y lo existente.** Usar las librerías que ya están en `package.json` antes de proponer nuevas.
- **No instalar dependencias sin autorización.**
- **Seguir las convenciones existentes.** Mirar archivos vecinos para copiar patrones (naming, imports, estructura).
- Si se detecta un bug no relacionado con la tarea actual, **reportarlo pero no arreglarlo** a menos que se pida.

---

## 2 · Economía de tokens — reglas de eficiencia

> Estas reglas reducen gasto de tokens y mejoran la velocidad de respuesta.

| Regla | Detalle |
|-------|---------|
| **Lectura incremental** | No leer archivos enteros si solo se necesita una sección. Leer por rangos de líneas. |
| **Ediciones quirúrgicas** | Editar solo las líneas que cambian. Nunca reescribir un archivo completo para cambiar una función. |
| **No repetir código** | No copiar el archivo entero en la respuesta. Mostrar solo el diff o las líneas relevantes. |
| **Respuestas cortas** | Evitar explicaciones extensas. Si el cambio es obvio, basta con: "Hecho. Se cambió X en `archivo.ts:42`." |
| **Agrupar ediciones** | Si hay múltiples cambios en un archivo, agruparlos en una sola pasada en vez de varias ediciones individuales. |
| **No recapitular** | No resumir lo que el usuario acaba de decir. No repetir el contexto del proyecto al inicio de cada respuesta. |
| **Búsquedas con criterio** | Usar `grep` con paths específicos y filtro por extensión (`*.ts`, `*.tsx`) cuando se conoce el área. **Excepción**: en renames o cambios de contrato, buscar en todo el proyecto — encontrar todos los usos importa más que ahorrar tokens. |
| **Un solo plan** | No presentar múltiples opciones salvo que se pidan. Ir con la mejor solución directamente. |

---

## 3 · Stack real (lo que usa el código)

> Desde 2026-06-11 EdificIA corre **100% sobre infraestructura propia**: sin InsForge ni Qdrant.

| Capa | Tecnología | Archivo clave |
|------|-----------|---------------|
| Framework | Next.js 16 (App Router) + TypeScript strict | `next.config.ts` |
| Modelo AI | **DeepSeek** vía OpenAI-compatible SDK | `src/app/api/chat/route.ts` |
| Agente (cerebro) | Servicio Python FastAPI detrás de flag `AGENT_BACKEND=python` | `services/agent/` |
| Embeddings | NVIDIA NIM (`baai/bge-m3`, 1024 dims) | `src/lib/embeddings/index.ts` |
| Capa de datos | Query-builder propio sobre `pg` (interfaz compatible `.from().select().eq()` → `{data,error}`) | `src/lib/db/` (`getInsForgeAdminClient()` en `src/lib/insforge/server.ts` es re-export histórico) |
| Auth | Propia: `auth.users` + bcryptjs + JWT HS256 local (`AUTH_JWT_SECRET`) + refresh tokens con rotación | `src/lib/auth/local-auth.ts` · `local-jwt.ts` |
| Storage | Filesystem local (`STORAGE_DIR`, default `./data/storage`) con interfaz de adapter | `src/lib/storage/fs-adapter.ts` |
| Vector DB | pgvector en el mismo Postgres (`document_chunks.embedding`) | `src/lib/rag/vector.ts` |
| DB | PostgreSQL 16 + pgvector — aislamiento multi-tenant **app-level** (las policies RLS existen en migraciones pero el backend conecta como owner y las bypassea) | `migrations/` (runner propio `scripts/migrate.mjs`) |
| Memoria del agente | `agent_memories` + `agent_feedback` (reflexión LLM + feedback + decay) | `services/agent/app/memory/` |
| Validación | Zod v3 | `src/lib/validators/` |
| Email | Resend | `src/lib/email/resend.ts` |
| UI | Shadcn + Tailwind v4 + Framer Motion | `src/components/` |

## 4 · Autenticación — Cómo funciona

1. **Proxy / Middleware** (`src/proxy.ts`): Protege `/dashboard/*`. Lee cookie `edificia_session` y **verifica la firma HS256 localmente** (jose, `AUTH_JWT_SECRET`); redirige a `/login` si no hay sesión. También maneja CORS para `/api/*`.
2. **API routes**: Usan `requireAuth(req)` de `src/lib/auth/require-auth.ts`. Extrae Bearer token, verifica firma local (`verifyUserId`), resuelve org membership.
3. **Cliente**: `getAuthToken()` en `src/lib/insforge/client.ts` maneja refresh automático vía `POST /api/auth/refresh` (rotación server-side en `auth.refresh_tokens`).
4. **Roles**: `admin` | `engineer` | `viewer`. Los admins acceden a `/api/admin/*`. Los viewers solo chatean.

> ⚠️ **NO crear rutas de API sin `requireAuth()`**. Excepciones conocidas: `/api/health`, `/api/auth/register`, `/api/seed-demo`, `/api/super-admin/*` (auth propia con `SUPER_ADMIN_KEY`), `/api/internal/*` (tool gateway del agente Python, auth por `AGENT_GATEWAY_SECRET` — jamás exponer público).

## 5 · Multi-tenancy — Regla absoluta

Toda query a la DB (incluida la búsqueda pgvector) **DEBE** filtrar por `organization_id` (derivado de `auth.orgId`). Columna real: `organization_id`, **NO** `company_id`. Jamás asumir que los datos pueden cruzarse entre orgs. No confiar en IDs enviados por el cliente para aislar tenant: usar siempre el `auth.orgId` resuelto server-side.

> ⚠️ El RLS de las migraciones **no aplica hoy** (el pool conecta como owner, sin GUC por transacción). El filtro `organization_id` en código es la única línea de defensa: omitirlo en una query es un cross-tenant leak directo. Activar RLS real es pendiente en `docs/00_PRODUCTO.md`.

## 6 · Estructura principal

```
src/
├── app/api/          → API routes (auth, chat, upload, projects, documents, enterprise-context, work-cases, admin, super-admin, etc.)
├── app/dashboard/    → Chat, obras/[id], contexto (Inteligencia Empresarial: Radar/Fuentes/Mapa Vivo), expedientes, admin (documents = redirect legacy)
├── app/(auth)/       → Login, registro, forgot/reset password
├── components/chat/  → ChatInput, MessageBubble, FileCard, DropZone, DxfViewerModal, bloques UI generativa
├── hooks/            → useProjects, useOrgMember, useOrgs, useSessionHistory, useProjectDetails, etc.
├── contexts/         → SessionContext, ProjectContext
├── lib/ai/           → agent-prompt.ts (system prompt), agent-tools.ts (definiciones), agent-tools-bound.ts (con org-binding)
├── lib/rag/          → ingest.ts, search.ts (búsqueda híbrida: semántica + FTS + ilike)
├── lib/auth/         → local-jwt.ts, local-auth.ts, password.ts, jwt.ts, require-auth.ts, reset-token.ts
├── lib/db/           → pool.ts, query-builder.ts (compat SDK), sql.ts (raw), admin-client.ts, types.ts
├── lib/file-processor/ → PDF, Excel, DXF, DOCX, imagen
├── lib/export/       → Generadores de PDF (jsPDF), DOCX, XLSX
└── lib/api/          → errors.ts (helpers estandarizados), rate-limit.ts
```

## 7 · Documentación

Solo hay dos documentos (el resto vive en git y en el código):

| Archivo | Cuándo leerlo |
|---------|---------------|
| `docs/00_PRODUCTO.md` | **Al inicio de tareas de producto**. Visión canónica, estado del sistema y pendientes vigentes. |
| `docs/EXPLICACION_PROYECTO_PARA_VOS.md` | Mapa técnico: stack, flujos frontend↔backend, agente, RAG, auth y tablas. Antes de cambios arquitectónicos. |

## 7.1 · Decisiones de producto vigentes

1. **Base Documental ya no es un producto separado: vive dentro de Inteligencia / Contexto Empresarial.** EdificIA no debe pensarse como un repositorio de archivos subidos. La carga y preparación de archivos es la pestaña **Fuentes** dentro de `/dashboard/contexto`, junto a Radar y Mapa Vivo. El objetivo es conectarse de forma segura y principalmente de solo lectura a fuentes reales de la constructora, construir contexto de empresa, detectar obras activas, clasificar documentos y habilitar auditoría transversal.
2. **Lectura agéntica de documentos.** El agente no debe comportarse como pipeline hardcodeado de tools. Debe clasificar, formar hipótesis, extraer señales, contrastar con contexto, verificar con tools y sintetizar hechos/riesgos/inferencias.
3. **Las tools son instrumentos, no el razonamiento.** No diseñar UX ni prompts que digan "ejecutando 9 reglas" o expongan mecánicas internas como si fueran el producto.
4. **Bloques Shadcn externos como referencia, no código productivo directo.** Nunca correr `npx shadcn add` de un bloque directamente contra `src/` (puede pisar archivos productivos y traer dependencias nuevas). Revisar el código del bloque y adaptarlo a tokens, componentes e identidad de EdificIA antes de incorporar algo a `src/components/`.
5. **La identidad del agente es Project Manager Digital; la auditoría es una capacidad bajo señal, no la apertura por defecto.** Con obra activa y sin archivo, el agente abre con el estado operativo del día. El playbook de auditoría se activa cuando llega un documento o el usuario lo pide. No reintroducir el sesgo "¿qué auditamos hoy?" en prompts, quick-prompts ni UX.

## 8 · Reglas de código

1. **TypeScript estricto**. Validar con Zod. No usar `any` sin justificación.
2. **Ediciones quirúrgicas**: No reescribir archivos enteros si solo cambia una función.
3. **No instalar dependencias** sin autorización. Priorizar lo que ya está: Vercel AI SDK, xlsx, pdf-parse, jsPDF, mammoth, dxf-parser.
4. **UI Generativa**: Bloques visuales bajo `src/components/chat/blocks/`. No imprimir tablas en Markdown cuando existe un bloque.
5. **Identidad**: Nunca llamar al producto "startup", "bot" o "SaaS". Es un **Sistema Integral de Gestión** o **Infraestructura Empresarial**.

## 9 · Lo que NO hay que tocar (estable y funcional)

- `src/lib/rag/` — Búsqueda híbrida funcionando. No refactorizar sin razón.
- `src/lib/file-processor/` — Procesadores de PDF, Excel, DXF, DOCX, imagen. Funcionan.
- `src/lib/db/` — Capa de datos compatible. Su semántica ({data,error}, nunca lanza) está codificada en tests; no cambiarla sin actualizar contratos.
- `migrations/` — ruta canónica de migraciones. Crear con `npm run migrate:new` y aplicar con `npm run migrate`.
- `src/components/chat/blocks/` — 6 bloques de UI Generativa completos y funcionando (metrics, media, comparison, timeline, risk_register, evidence_ledger).
