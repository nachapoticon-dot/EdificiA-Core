# EdificIA — Contexto para Claude Code

EdificIA es un **Sistema de Operaciones Autónomo para la Construcción**. El agente IA actúa como *Project Manager Digital* para constructoras argentinas. Multi-tenant estricto.

---

## Stack real (lo que usa el código)

| Capa | Tecnología | Archivo clave |
|------|-----------|---------------|
| Framework | Next.js 16 (App Router) + TypeScript strict | `next.config.ts` |
| Modelo AI | **DeepSeek** vía OpenAI-compatible SDK | `src/app/api/chat/route.ts` |
| Embeddings | NVIDIA NIM (`text-embedding-3-small`) | `src/lib/embeddings/index.ts` |
| BaaS | InsForge (auth, DB, storage) | `src/lib/insforge/server.ts` (admin) · `client.ts` (browser) |
| Vector DB | Qdrant | `src/lib/qdrant/client.ts` |
| DB | PostgreSQL con RLS multi-tenant | `db/migrations/` (14 archivos) |
| Validación | Zod v3 | `src/lib/validators/` |
| Email | Resend | `src/lib/email/resend.ts` |
| UI | Shadcn + Tailwind v4 + Framer Motion | `src/components/` |

## Autenticación — Cómo funciona

1. **Middleware** (`src/middleware.ts`): Protege `/dashboard/*`. Lee cookie `edificia_session`, valida JWT localmente, redirige a `/login` si no hay sesión.
2. **API routes**: Usan `requireAuth(req)` de `src/lib/auth/require-auth.ts`. Extrae Bearer token, verifica contra InsForge, resuelve org membership.
3. **Cliente**: `getAuthToken()` en `src/lib/insforge/client.ts` maneja refresh automático del token.
4. **Roles**: `admin` | `engineer` | `viewer`. Los admins acceden a `/api/admin/*`. Los viewers solo chatean.

> ⚠️ **NO crear rutas de API sin `requireAuth()`**. Excepción: `/api/health`, `/api/auth/register`, `/api/super-admin/*` (auth propia con `SUPER_ADMIN_KEY`).

## Multi-tenancy — Regla absoluta

Toda query a la DB o Qdrant **DEBE** filtrar por `organization_id` (derivado de `auth.orgId`). Columna real: `organization_id`, **NO** `company_id`. Jamás asumir que los datos pueden cruzarse entre orgs.

## Estructura principal

```
src/
├── app/api/          → 31 API routes (auth, chat, upload, projects, documents, admin, super-admin, etc.)
├── app/dashboard/    → Chat principal, obras/[id], documents, admin, blocks-demo
├── app/(auth)/       → Login, registro, forgot/reset password
├── components/chat/  → ChatInput, MessageBubble, FileCard, DropZone, DxfViewerModal, bloques UI generativa
├── hooks/            → useProjects, useOrgMember, useOrgs, useSessionHistory, useProjectDetails, etc.
├── contexts/         → SessionContext, ProjectContext
├── lib/ai/           → agent-prompt.ts (system prompt), agent-tools.ts (definiciones), agent-tools-bound.ts (con org-binding)
├── lib/rag/          → ingest.ts, search.ts (búsqueda híbrida: semántica + FTS + ilike)
├── lib/auth/         → jwt.ts, require-auth.ts, reset-token.ts
├── lib/file-processor/ → PDF, Excel, DXF, DOCX, imagen
├── lib/export/       → Generadores de PDF (jsPDF), DOCX, XLSX
└── lib/api/          → errors.ts (helpers estandarizados), rate-limit.ts
```

## Documentación de planificación

**ANTES de proponer cambios arquitectónicos, leer estos archivos:**

| Archivo | Cuándo leerlo |
|---------|---------------|
| `docs/planning/TAREAS_CLAUDE.md` | **Siempre al inicio**. Lista de bugs activos y tareas pendientes con archivo y línea exacta. |
| `docs/planning/PLAN_DE_MEJORA.md` | Para entender el roadmap general y qué ya está hecho. |
| `docs/planning/PLAN_LOGIN_FRONTEND_BACKEND.md` | Si vas a tocar autenticación o cookies. |
| `docs/planning/PLAN_FLUJO_EMPRESAS.md` | Si vas a tocar roles, invitaciones, o registro. |
| `docs/04_architecture_map.md` | Para ver el grafo de dependencias y el stack de paquetes. |

## Reglas de código

1. **TypeScript estricto**. Validar con Zod. No usar `any` sin justificación.
2. **Ediciones quirúrgicas**: No reescribir archivos enteros si solo cambia una función.
3. **No instalar dependencias** sin autorización. Priorizar lo que ya está: Vercel AI SDK, xlsx, pdf-parse, jsPDF, mammoth, dxf-parser.
4. **UI Generativa**: Bloques visuales bajo `src/components/chat/blocks/`. No imprimir tablas en Markdown cuando existe un bloque.
5. **Identidad**: Nunca llamar al producto "startup", "bot" o "SaaS". Es un **Sistema Integral de Gestión** o **Infraestructura Empresarial**.

## Lo que NO hay que tocar (estable y funcional)

- `src/lib/rag/` — Búsqueda híbrida funcionando. No refactorizar sin razón.
- `src/lib/file-processor/` — Procesadores de PDF, Excel, DXF, DOCX, imagen. Funcionan.
- `src/lib/ai/agent-tools.ts` y `agent-tools-bound.ts` — 38KB de tools. Muy estable.
- `src/lib/ai/agent-prompt.ts` — System prompt de 198 líneas cuidadosamente calibrado.
- `db/migrations/` — NO modificar migraciones existentes. Solo agregar nuevas.
- `src/components/chat/blocks/` — 4 bloques de UI Generativa completos y funcionando.
