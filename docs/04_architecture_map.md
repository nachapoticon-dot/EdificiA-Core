# Mapa de Arquitectura y Dependencias (Repo Map)

Este documento contiene el mapa estructural del proyecto. 
**Regla para la IA**: Cada vez que crees un módulo nuevo (Frontend, Backend, Database), DEBES actualizar este grafo. Antes de modificar código existente, lee este grafo para entender qué otras partes del sistema vas a afectar y evitar romper el código.

```mermaid
graph TD
    %% Entidades externas
    User[Usuario / Ingeniero]

    %% Auth Flow
    LoginPage[Login Page\nsrc/app/auth/login]
    Middleware[Next.js Middleware\nsrc/middleware.ts]
    AuthLayout[Auth Layout\nsrc/app/auth/layout.tsx]

    %% Dashboard
    ChatUI[Next.js Chat UI\nsrc/app/dashboard/chat]
    ChatAPI[API Route /api/chat\nsrc/app/api/chat/route.ts]

    %% AI
    AI_Agent[Vercel AI SDK Agent\nsrc/lib/ai/agent.ts]

    %% InsForge
    BrowserClient[InsForge Browser Client\nsrc/lib/insforge/client.ts]
    AdminClient[InsForge Admin Client\nsrc/lib/insforge/server.ts]
    InsForgeBackend[InsForge BaaS\nhttps://***INSFORGE_URL_REDACTED***]

    %% DB
    DB[(PostgreSQL RLS\norganizations · organization_members\nprojects · uploaded_files\naudit_sessions · chat_messages\norganization_invitations · audit_results)]

    %% Tools Sprint 2+
    Parser[Parser Multimodal\nSprint 3]
    MathEngine[Motor Matemático\nsrc/lib/math-engine/]

    %% Validators
    Validators[Zod Schemas\nsrc/lib/validators/]

    %% Conexiones Auth
    User -- "GET /login" --> Middleware
    Middleware -- "No cookie → redirect" --> LoginPage
    Middleware -- "Cookie ok → pass" --> ChatUI
    LoginPage -- "signInWithPassword" --> BrowserClient
    BrowserClient -- "Auth API" --> InsForgeBackend
    InsForgeBackend -- "httpOnly cookie" --> LoginPage

    %% Conexiones Chat
    User -- "Sube Archivos / Pregunta" --> ChatUI
    ChatUI -- "POST /api/chat" --> ChatAPI
    ChatAPI -- "streamText + tools" --> AI_Agent
    AI_Agent -- "Tool: Auditar" --> MathEngine
    AI_Agent -- "Tool: Extraer Datos" --> Parser
    AI_Agent -- "INSERT audit_results" --> AdminClient
    MathEngine -- "Valida con" --> Validators

    %% DB
    AdminClient -- "Queries RLS" --> InsForgeBackend
    InsForgeBackend -- "PostgREST" --> DB
```

## Stack de Dependencias (2026-04-29)

| Paquete | Versión | Rol |
|---|---|---|
| next | ^16.2.4 | Framework Frontend + API Routes |
| react | ^19.0.0 | UI Runtime |
| typescript | ^5 | Tipado estricto E2E |
| tailwindcss | ^4 | Estilos utility-first |
| shadcn/ui | ^4.6.0 | Componentes UI premium |
| @tanstack/react-query | ^5.74.4 | Data fetching / cache del cliente |
| zod | ^3.24.3 | Validación de schemas E2E |
| @insforge/sdk | ^1.2.5 | BaaS client — auth, database, storage |
| ai | ^6 | Vercel AI SDK — streaming + tools |
| @ai-sdk/anthropic | ^3 | Provider Claude para el SDK |

## Estructura de Carpetas (`src/`)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx            → Layout centrado para auth
│   │   └── login/page.tsx        → Formulario de login (Client Component)
│   ├── (dashboard)/chat/         → Chat principal con el agente (Sprint 2)
│   ├── api/chat/route.ts         → Route handler streaming (Sprint 2)
│   ├── layout.tsx                → Root layout (Geist font, QueryClientProvider)
│   └── globals.css               → Variables Shadcn + Tailwind v4
├── components/
│   ├── providers.tsx             → QueryClientProvider wrapper
│   └── ui/                       → Componentes Shadcn (auto-generados)
├── lib/
│   ├── insforge/
│   │   ├── client.ts             → Browser client singleton
│   │   └── server.ts             → Admin client (service role key)
│   ├── ai/agent.ts               → Config del agente (Sprint 2)
│   ├── math-engine/              → Motor de auditoría (Sprint 2)
│   └── validators/               → Schemas Zod compartidos E2E
├── middleware.ts                 → Protección de rutas via cookie
└── types/index.ts                → Tipos branded del dominio

db/
└── migrations/
    ├── 001_initial_schema.sql      → organizations + organization_members + RLS
    ├── 002_files_and_sessions.sql  → projects + uploaded_files + audit_sessions + chat_messages + RLS
    ├── 003_hardening.sql           → indexes + soft deletes + columnas faltantes + RLS fixes
    └── 004_new_tables.sql          → organization_invitations + audit_results + RLS
```

## Registro de Cambios Estructurales

| Fecha | Sprint | Cambio |
|---|---|---|
| 2026-04-28 | Sprint 0 | Scaffold inicial: Next.js 16 + TS strict + Shadcn + Vercel AI SDK v6 + TanStack Query + Zod |
| 2026-04-29 | Sprint 1 | Auth flow completo: InsForge client (browser + admin), middleware de rutas, login form, schema PostgreSQL con RLS multi-tenant |
| 2026-04-29 | Sprint 1.5 | DB hardening: 14 indexes, soft deletes en 5 tablas, columnas faltantes, RLS fixes, 2 nuevas tablas (organization_invitations + audit_results), fix open redirect middleware, env-var validation |
