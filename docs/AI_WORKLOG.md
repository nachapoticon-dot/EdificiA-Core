# AI Worklog - EdificIA

Registro corto para alternar entre Codex, Claude Code y otros agentes sin releer toda la historia del proyecto.

Reglas:

- Mantener entradas breves y accionables.
- Registrar solo cambios relevantes o handoffs con estado incompleto.
- No duplicar el roadmap. Los pendientes estratégicos viven en `ROADMAP.md`.
- Incluir verificación ejecutada o explicar por qué no se ejecutó.

Formato:

```md
## YYYY-MM-DD - Agente - Tarea corta

- Objetivo: ...
- Cambios: ...
- Archivos: `ruta/a.ts`, `ruta/b.tsx`
- Verificacion: `npm run type-check` OK / no ejecutado porque ...
- Pendiente: ...
```

---

## 2026-05-16 - Codex - Reglas operativas compartidas

- Objetivo: crear una guía nativa para Codex y un registro de handoff compatible con Claude Code.
- Cambios: agregado `AGENTS.md` con reglas de contexto, colaboración, economía de tokens, auth, multi-tenancy, zonas estables y verificación. `CLAUDE.md` ahora referencia el worklog compartido.
- Archivos: `AGENTS.md`, `CLAUDE.md`, `docs/AI_WORKLOG.md`, `docs/README.md`
- Verificacion: no ejecutada; solo documentación.
- Pendiente: mantener `AGENTS.md` y `CLAUDE.md` sincronizados cuando cambien reglas críticas.

## 2026-05-16 - Codex - Auditoría base pre-roadmap

- Objetivo: revisar errores de código y conceptuales antes de seguir con el roadmap.
- Cambios: corregido `useSessionHistory` con `useSyncExternalStore`; endurecido `/api/admin/patterns` para admin; agregado helper `isAtLeast`; ajustado prompt para no mencionar tools inexistentes de clima/HSE; eliminado fetch externo de Google Fonts en build; endurecido secreto de reset password en producción.
- Archivos: `src/hooks/useSessionHistory.ts`, `src/app/api/admin/patterns/route.ts`, `src/app/dashboard/admin/patterns/page.tsx`, `src/lib/auth/require-auth.ts`, `src/lib/ai/agent-prompt.ts`, `src/lib/auth/reset-token.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `.env.local.example`, `.env.docker.example`, `ROADMAP.md`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK con permisos fuera del sandbox.
- Pendiente: consolidar migraciones duplicadas `db/migrations/` vs `migrations/`; agregar tests unitarios; conectar fuente real de clima/HSE si se quiere reactivar esas capacidades como tools.

## 2026-05-16 - Codex - Refinamiento visual dashboard

- Objetivo: mejorar el estilo visual de la experiencia principal sin cambiar flujos de negocio.
- Cambios: agregado fondo técnico tipo blueprint, sidebar más denso, navegación activa más clara, header/input con superficie translúcida, dropzones y chips visuales más sobrios, radios reducidos y sombras más controladas.
- Archivos: `src/app/globals.css`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/chat/page.tsx`, `src/components/chat/AgentGreeting.tsx`, `src/components/chat/ChatInput.tsx`, `src/components/chat/NavLink.tsx`, `src/components/chat/OrganizationCard.tsx`, `src/components/chat/SessionSidebar.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK; servidor local activo en `http://localhost:3000`.
- Pendiente: hacer QA visual manual autenticado en `/dashboard/chat` con datos reales de una organización.

## 2026-05-16 - Codex - Refinamiento visual login

- Objetivo: alinear la pantalla de login con el nuevo lenguaje visual del dashboard.
- Cambios: `AuthLayout` ahora usa fondo blueprint, columna editorial desktop y panel translúcido; `login/page.tsx` tiene encabezado operativo, badge de sesión protegida, inputs con iconos y CTA más claro. Copy ajustado a un tono más técnico y atractivo para usuarios finales: centro operativo, decisiones críticas, trazabilidad técnica y legajos consultables.
- Archivos: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK; `GET /login` responde 200 en `http://127.0.0.1:3000/login`.
- Pendiente: QA visual manual en mobile/desktop.

## 2026-05-16 - Codex - Header chat y modelo DeepSeek

- Objetivo: recuperar el espacio vertical ocupado por el topbar de configuración y corregir el label del modelo.
- Cambios: `TopBarActions` se movió al header del chat, a la izquierda del badge de modelo; el topbar desktop vacío se eliminó y solo queda barra móvil; el badge ahora dice `DeepSeek V4 Flash`; default `AI_MODEL` actualizado a `deepseek-v4-flash`.
- Archivos: `src/app/dashboard/layout.tsx`, `src/app/dashboard/chat/page.tsx`, `src/lib/ai/agent-prompt.ts`, `.env.docker.example`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: si `.env.local` define `AI_MODEL=deepseek-chat`, cambiarlo manualmente a `deepseek-v4-flash` para que runtime y UI queden alineados.

## 2026-05-16 - Codex - Saludo con nombre de pila confiable

- Objetivo: evitar que el greeting use correos o aliases como nombre del usuario.
- Cambios: `/api/auth/me` expone `displayName` si el JWT/perfil trae nombre real; `AgentGreeting` usa nombre de pila solo si viene de perfil o si el email parece claramente humano compuesto (`nombre.apellido`). Si no hay confianza, saluda sin nombre.
- Archivos: `src/lib/auth/jwt.ts`, `src/app/api/auth/me/route.ts`, `src/types/index.ts`, `src/app/dashboard/chat/page.tsx`, `src/components/chat/AgentGreeting.tsx`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: si InsForge no incluye el nombre en el JWT, considerar guardar `display_name` en `organization_members` o una tabla `user_profiles`.

## 2026-05-16 - Codex - Concepto Contexto Empresarial

- Objetivo: ampliar el concepto de Base Documental hacia lanzamiento empresarial.
- Cambios: agregado `docs/06_enterprise_context_layer.md`; README y roadmap ahora reflejan que EdificIA debe conectarse de forma segura a fuentes empresariales, extraer obras activas, clasificar documentos y auditar una constructora completa.
- Archivos: `docs/06_enterprise_context_layer.md`, `docs/README.md`, `README.md`, `ROADMAP.md`
- Verificacion: no ejecutada; solo documentación de producto/arquitectura.
- Pendiente: convertir esta visión en esquema de DB para conectores, inventario, entidades empresariales y sync runs.

## 2026-05-16 - Codex - Lectura agéntica de documentos

- Objetivo: evitar que el agente parezca un programa hardcodeado que solo corre tools fijas.
- Cambios: agregado `docs/07_agentic_document_reading.md`; prompt actualizado con ciclo de clasificación, hipótesis, extracción, contraste, verificación y síntesis; labels visibles de tools ahora comunican lectura/contraste en vez de reglas internas.
- Archivos: `src/lib/ai/agent-prompt.ts`, `src/components/chat/MessageBubble.tsx`, `docs/07_agentic_document_reading.md`, `docs/README.md`, `ROADMAP.md`
- Verificacion: `npm run lint` OK; `npm run type-check` OK; `npm run build` OK.
- Pendiente: diseñar tools semánticas futuras como `clasificar_documento_obra`, `extraer_metadatos_documento` y `comparar_documento_con_contexto`.

## 2026-05-16 - Codex - Sincronización guías IA y limpieza

- Objetivo: asegurar que Claude Code y Codex entiendan las nuevas decisiones de producto.
- Cambios: `CLAUDE.md` y `AGENTS.md` ahora referencian Contexto Empresarial y Lectura Agéntica como decisiones vigentes. Eliminada carpeta local ignorada `.claude-flow/`. Eliminados artifacts locales `.next/` y `tsconfig.tsbuildinfo`. Corregidas referencias obsoletas a `src/middleware.ts`; el guard activo es `src/proxy.ts`.
- Archivos: `CLAUDE.md`, `AGENTS.md`, `docs/04_architecture_map.md`, `docs/AI_WORKLOG.md`
- Verificacion: `find` no muestra restos `.claude-flow`, `.swarm`, `agentdb`, `ruvector`, `mcp-servers` ni carpetas de agentes ignoradas. Puerto 3000 libre. `.next/` y `tsconfig.tsbuildinfo` eliminados.
- Pendiente: ninguno de limpieza local detectado.
