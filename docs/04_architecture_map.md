# Mapa de Arquitectura y Dependencias (Repo Map)

Este documento contiene el mapa estructural del proyecto. 
**Regla para la IA**: Cada vez que crees un módulo nuevo (Frontend, Backend, Database), DEBES actualizar este grafo. Antes de modificar código existente, lee este grafo para entender qué otras partes del sistema vas a afectar y evitar romper el código.

```mermaid
graph TD
    %% Nodos Principales
    User[Usuario / Ingeniero]
    ChatUI[Next.js Chat UI\nsrc/app/dashboard/chat]
    AI_Agent[Vercel AI SDK Agent\nsrc/lib/ai/agent.ts]
    InsForge[InsForge BaaS MCP\nsrc/lib/insforge/client.ts]
    
    %% Herramientas (Tools)
    Parser[Parser Multimodal\nSprint 3]
    MathEngine[Motor Matemático Agnóstico\nsrc/lib/math-engine/]
    DB[(PostgreSQL RLS\nInsForge)]
    Storage[Storage Legajos\nInsForge]

    %% Auth
    Auth[Auth Flow\nsrc/app/auth/login]

    %% Validators
    Validators[Zod Schemas\nsrc/lib/validators/]

    %% Conexiones
    User -- "Sube Archivos / Pregunta" --> ChatUI
    User -- "Login" --> Auth
    Auth -- "Session Token" --> InsForge
    ChatUI -- "POST /api/chat" --> AI_Agent
    AI_Agent -- "Guarda/Lee" --> InsForge
    InsForge -- "Gestiona" --> DB
    InsForge -- "Almacena" --> Storage
    
    %% Uso de Herramientas
    AI_Agent -- "Tool: Extraer Datos" --> Parser
    AI_Agent -- "Tool: Auditar" --> MathEngine
    MathEngine -- "Valida con" --> Validators
```

## Stack de Dependencias (2026-04-28)

| Paquete | Versión | Rol |
|---|---|---|
| next | ^16.2.4 | Framework Frontend + API Routes |
| react | ^19.0.0 | UI Runtime |
| typescript | ^5 | Tipado estricto E2E |
| tailwindcss | ^4 | Estilos utility-first |
| shadcn/ui | ^4.6.0 | Componentes UI premium |
| @tanstack/react-query | ^5.74.4 | Data fetching / cache del cliente |
| zod | ^3.24.3 | Validación de schemas E2E |
| ai | latest (v6) | Vercel AI SDK — streaming + tools |
| @ai-sdk/anthropic | latest | Provider Claude para el SDK |

## Estructura de Carpetas (`src/`)

```
src/
├── app/
│   ├── (auth)/login/         → Flujo de autenticación InsForge
│   ├── (dashboard)/chat/     → Chat principal con el agente
│   ├── api/chat/             → Route handler streaming del agente
│   ├── layout.tsx            → Root layout (Geist font, dark mode)
│   └── globals.css           → Variables Shadcn + Tailwind v4
├── components/
│   └── ui/                   → Componentes Shadcn (auto-generados)
├── lib/
│   ├── insforge/client.ts    → Cliente BaaS centralizado
│   ├── ai/agent.ts           → Config del agente (modelo, tools)
│   ├── math-engine/          → Motor de auditoría (Sprint 2)
│   └── validators/           → Schemas Zod compartidos E2E
└── types/index.ts            → Tipos branded del dominio
```

## Registro de Cambios Estructurales

| Fecha | Sprint | Cambio |
|---|---|---|
| 2026-04-28 | Sprint 0 | Scaffold inicial: Next.js 16 + TS strict + Shadcn + Vercel AI SDK v6 + TanStack Query + Zod |
