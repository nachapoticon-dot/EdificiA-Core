# Edificia

> Plataforma de inteligencia artificial conversacional para empresas constructoras.

Edificia es un SaaS B2B multi-tenant que permite a equipos de ingeniería y arquitectura auditar presupuestos de obra, procesar legajos técnicos y consultar normativa mediante lenguaje natural. El sistema actúa como un asistente especializado que entiende el contexto de cada empresa y devuelve resultados en el formato que el equipo necesita.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript strict |
| UI | Shadcn UI · Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Validación | Zod v3 — schemas compartidos E2E |
| AI | Vercel AI SDK v6 · Claude (Anthropic) |
| Backend / Auth / Storage | InsForge BaaS |
| Base de datos | PostgreSQL con Row-Level Security multi-tenant |

## Desarrollo local

**Requisitos:** Node.js 22 LTS · npm 10+

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/nachapoticon-dot/edificia.git
cd edificia
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local
# Completar ANTHROPIC_API_KEY, INSFORGE_SERVICE_ROLE_KEY y NEXT_PUBLIC_INSFORGE_PROJECT_ID

# 3. Levantar servidor de desarrollo
npm run dev
```

El servidor queda disponible en `http://localhost:3000`.

## Scripts

```bash
npm run dev          # Servidor de desarrollo con Turbopack
npm run build        # Build de producción
npm run type-check   # Verificación de tipos TypeScript
npm run lint         # ESLint
```

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/         # Autenticación
│   ├── (dashboard)/chat/     # Interfaz conversacional principal
│   └── api/chat/             # Route handler del agente AI
├── components/
│   └── ui/                   # Componentes Shadcn
├── lib/
│   ├── ai/agent.ts           # Configuración del agente conversacional
│   ├── insforge/client.ts    # Cliente BaaS centralizado
│   ├── math-engine/          # Motor de auditoría de presupuestos
│   └── validators/           # Schemas Zod compartidos
└── types/index.ts            # Tipos de dominio
```

## Licencia

Propietario · Todos los derechos reservados.
