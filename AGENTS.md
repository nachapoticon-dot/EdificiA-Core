# EdificIA - Contexto para Codex

EdificIA es un **Sistema de Operaciones Autónomo para la Construcción**. El agente IA actúa como *Project Manager Digital* para constructoras argentinas. El producto es multi-tenant estricto y apunta a operación empresarial, no a una demo ni a un bot genérico.

Este archivo es la guía operativa de Codex. `CLAUDE.md` sigue siendo la guía operativa de Claude Code. Ambos archivos deben mantenerse compatibles para poder alternar entre modelos sin perder contexto.

---

## 1. Arranque de cada sesión

1. Leer `ROADMAP.md` antes de elegir una tarea o proponer orden de trabajo.
2. Leer los archivos directamente involucrados antes de editar. No asumir contenido por nombre de archivo.
3. Si el cambio toca arquitectura, leer `docs/04_architecture_map.md`.
4. Si el cambio toca auditoría, presupuestos, documentos de obra o lógica de dominio, leer `docs/03_domain_knowledge.md`.
5. Si el cambio toca Base Documental, conectores, RAG empresarial o auditoría transversal, leer `docs/06_enterprise_context_layer.md`.
6. Si el cambio toca prompt, tools de documentos o UX de auditoría, leer `docs/07_agentic_document_reading.md`.
7. Revisar `docs/AI_WORKLOG.md` para ver el último handoff entre agentes.
8. Revisar `git status --short` antes de editar. No revertir cambios ajenos.

---

## 2. Reglas de colaboración Codex / Claude Code

- `CLAUDE.md` y `AGENTS.md` deben decir lo mismo en las reglas críticas: auth, multi-tenancy, estilo de edición, verificación y prioridades.
- Al terminar una tarea relevante, agregar una entrada breve en `docs/AI_WORKLOG.md`.
- Si se cambia una regla operativa para un agente, evaluar si debe reflejarse también en el archivo del otro agente.
- No duplicar documentación larga. `ROADMAP.md` concentra pendientes; `docs/04_architecture_map.md` concentra arquitectura; `docs/AI_WORKLOG.md` concentra handoffs recientes.
- Cuando una sesión deje trabajo incompleto, registrar exactamente qué quedó pendiente y qué archivos estaban en curso.

Formato de handoff recomendado:

```md
## YYYY-MM-DD - Agente - Tarea corta

- Objetivo: ...
- Cambios: ...
- Archivos: `ruta/a.ts`, `ruta/b.tsx`
- Verificacion: `npm run type-check` OK / no ejecutado porque ...
- Pendiente: ...
```

---

## 3. Comunicación

- Responder en **español**.
- Ir al punto. No recapitular contexto que el usuario acaba de dar.
- Al cerrar una tarea, reportar: qué se hizo, archivos tocados, verificación ejecutada y pendiente real si existe.
- No pegar archivos enteros en la respuesta. Referenciar rutas y líneas cuando haga falta.
- Si se detecta un bug no relacionado, reportarlo y no arreglarlo salvo pedido explícito.

---

## 4. Economía de tokens

- Usar `rg` / `rg --files` para ubicar archivos y símbolos.
- Leer por rangos con `sed -n` cuando sea suficiente.
- Evitar búsquedas amplias si ya se conoce el área del repo.
- Editar de forma quirúrgica con `apply_patch`; no reescribir archivos completos para cambios chicos.
- Agrupar cambios relacionados en una sola edición por archivo cuando sea razonable.
- No abrir docs históricas si `ROADMAP.md` ya tiene el estado consolidado.
- Mantener respuestas cortas salvo que el usuario pida análisis detallado.

---

## 5. Stack real

| Capa | Tecnología | Archivo clave |
|---|---|---|
| Framework | Next.js 16 App Router + TypeScript strict | `next.config.ts` |
| UI | Shadcn UI + Tailwind CSS v4 + Framer Motion | `src/components/` |
| Data fetching | TanStack Query v5 | `src/hooks/` |
| AI / agente | Vercel AI SDK v6 + DeepSeek OpenAI-compatible | `src/app/api/chat/route.ts` |
| Embeddings | NVIDIA NIM / OpenAI-compatible `text-embedding-3-small` | `src/lib/embeddings/` |
| Vector DB | Qdrant | `src/lib/qdrant/` |
| Backend/Auth/Storage | InsForge | `src/lib/insforge/` |
| DB | PostgreSQL con RLS multi-tenant | `db/migrations/`, `migrations/` |
| Validación | Zod v3 | `src/lib/validators/` |
| Email | Resend | `src/lib/email/` |
| Export | jsPDF, docx, xlsx | `src/lib/export/` |

---

## 6. Auth y multi-tenancy

- Toda API privada debe usar `requireAuth(req)` desde `src/lib/auth/require-auth.ts`.
- Excepciones conocidas: `/api/health`, `/api/auth/register`, `/api/seed-demo`, `/api/super-admin/*` con `SUPER_ADMIN_KEY`.
- Toda query a DB, storage lógico o Qdrant debe filtrar por `organization_id` derivado de `auth.orgId`.
- La columna real es `organization_id`, no `company_id`.
- No confiar en IDs enviados por el cliente para aislar tenant si ya existe `auth.orgId` server-side.
- Roles actuales: `admin`, `engineer`, `viewer`.

---

## 7. Reglas de código

- TypeScript estricto. Evitar `any`; si es inevitable, justificarlo en el código o en el cierre.
- Usar Zod para validar límites entre cliente, API y datos externos.
- Seguir patrones locales antes de introducir abstracciones nuevas.
- No instalar dependencias sin autorización.
- No crear rutas API privadas sin auth.
- No modificar migraciones existentes en `db/migrations/`; agregar nuevas si corresponde.
- Si se agrega un módulo estructural nuevo, actualizar `docs/04_architecture_map.md`.
- Si se cambia una prioridad o se completa un pendiente relevante, actualizar `ROADMAP.md`.

---

## 7.1. Decisiones de producto vigentes

- **Base Documental evoluciona a Contexto Empresarial.** EdificIA no debe ser un repositorio de archivos subidos. Debe conectarse de forma segura y principalmente de solo lectura a fuentes reales de la constructora, construir contexto de empresa, detectar obras activas, clasificar documentos y habilitar auditoría transversal. Ver `docs/06_enterprise_context_layer.md`.
- **Lectura agéntica de documentos.** El agente no debe comportarse como pipeline hardcodeado de tools. Debe clasificar, formar hipótesis, extraer señales, contrastar con contexto, verificar con tools y sintetizar hechos/riesgos/inferencias. Ver `docs/07_agentic_document_reading.md`.
- **Las tools son instrumentos, no el razonamiento.** No diseñar UX ni prompts que digan "ejecutando 9 reglas" o expongan mecánicas internas como si fueran el producto.

---

## 8. Zonas estables

No refactorizar estas áreas sin una razón directa de la tarea:

- `src/lib/rag/`
- `src/lib/file-processor/`
- `src/lib/ai/agent-tools.ts`
- `src/lib/ai/agent-tools-bound.ts`
- `src/lib/ai/agent-prompt.ts`
- `src/components/chat/blocks/`
- Migraciones ya aplicadas en `db/migrations/`

---

## 9. Verificación

- Para cambios de tipos o lógica compartida: `npm run type-check`.
- Para lint/estilo si se tocaron muchos archivos: `npm run lint`.
- Para build o cambios de Next/config: `npm run build` si el costo es razonable.
- Si no se puede ejecutar una verificación, explicar el motivo y el riesgo residual.

---

## 10. Identidad del producto

- Usar "EdificIA", "Sistema Integral de Gestión", "Sistema de Operaciones Autónomo" o "Infraestructura Empresarial".
- No llamar al producto "startup", "bot" o "SaaS" en copy de producto salvo que el usuario lo pida explícitamente.
- El dominio principal es construcción argentina: obras, presupuestos, legajos técnicos, HSE, ART/EPP, acopios, índices CAC, subcontratos y cronogramas.
