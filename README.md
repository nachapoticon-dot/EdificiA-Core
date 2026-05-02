# EdificIA

> Plataforma de inteligencia artificial para empresas constructoras.

EdificIA es un SaaS B2B multi-tenant que actúa como memoria institucional y cerebro operativo de una constructora. Los equipos de ingeniería y arquitectura pueden auditar presupuestos, consultar normativa, gestionar legajos técnicos y generar documentos formales — todo mediante lenguaje natural, en el contexto de cada empresa y obra.

---

## Capacidades principales

- **Chat con contexto documental** — El agente lee PDFs, planillas Excel, planos DXF e imágenes y responde preguntas sobre su contenido con precisión técnica.
- **RAG jerárquico** — Sistema de recuperación semántica con chunking por rubro/sección, detección de intención y pre-filtro por tipo documental. Los documentos se indexan por empresa y obra.
- **Generación autónoma de documentos** — Produce informes PDF, memorias descriptivas Word (.docx) y presupuestos Excel (.xlsx) directamente desde el chat.
- **Dashboard de obras** — Vista completa por obra: cobertura documental, historial de sesiones y acceso a legajos.
- **Índices de precio (CAC)** — Sistema append-only de índices de costo de la construcción, con histórico y comparación de variaciones.
- **Gestión de patrones** — Banco de cláusulas y ítems reutilizables por empresa para estandarizar presupuestos y documentos.
- **Multi-empresa para consultores** — Org switcher para usuarios que operan en múltiples empresas desde una sola cuenta.
- **Persistencia cross-device** — Las sesiones de chat se sincronizan entre dispositivos vía base de datos con fallback en localStorage.
- **Panel de administración** — Gestión de miembros, invitaciones, settings de organización y configuración del agente.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) · TypeScript strict |
| UI | Shadcn UI · Tailwind CSS v4 · Framer Motion |
| Data fetching | TanStack Query v5 |
| Validación | Zod v3 — schemas compartidos E2E |
| AI / Agente | Vercel AI SDK v6 · Claude (Anthropic) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector DB | Qdrant Cloud |
| Backend / Auth / Storage | InsForge BaaS |
| Base de datos | PostgreSQL con Row-Level Security multi-tenant |
| Email transaccional | Resend |
| Generación de documentos | jsPDF · docx · xlsx |

---

## Arquitectura

```
src/
├── app/
│   ├── (auth)/                   # Login · Registro
│   ├── dashboard/
│   │   ├── chat/                 # Interfaz conversacional principal
│   │   ├── obras/[id]/           # Detalle de obra con cobertura documental
│   │   ├── documents/            # Gestión de legajos técnicos
│   │   └── admin/                # Panel: miembros, patrones, índices, settings
│   └── api/
│       ├── chat/                 # Route handler del agente AI (streaming)
│       ├── generate/             # Generación de informe PDF, memoria DOCX, presupuesto XLSX
│       ├── documents/            # CRUD de documentos y procesamiento de archivos
│       ├── indices/              # Índices de precio CAC (append-only)
│       ├── projects/             # CRUD de obras y cobertura documental
│       ├── sessions/             # Persistencia de sesiones de chat
│       └── admin/                # Members, patrones, org settings
├── components/
│   ├── chat/                     # Chat UI: AgentGreeting, OrgSwitcher, FileChip…
│   ├── obras/                    # Componentes del dashboard de obras
│   └── ui/                       # Componentes Shadcn
├── hooks/                        # useProjects, useSessionHistory, useOrgMember…
├── contexts/                     # ProjectContext, SessionContext
└── lib/
    ├── ai/                       # System prompt y configuración del agente
    ├── rag/                      # Pipeline RAG: ingest, chunking, retrieval
    ├── embeddings/               # Cliente OpenAI embeddings
    ├── qdrant/                   # Cliente Qdrant + helpers de búsqueda vectorial
    ├── file-processor/           # Procesadores PDF, DOCX, Excel, DXF, imágenes
    ├── math-engine/              # Motor de auditoría de presupuestos
    ├── pattern-extractor/        # Extracción de patrones de documentos
    ├── indices/                  # Lógica de índices CAC
    ├── export/                   # Generadores PDF (jsPDF), DOCX, XLSX
    ├── email/                    # Invitaciones con Resend
    ├── insforge/                 # Cliente BaaS centralizado
    └── validators/               # Schemas Zod compartidos
```

---

## Desarrollo local

**Requisitos:** Node.js 22 LTS · npm 10+

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/nachapoticon-dot/EdificIA.git
cd EdificIA
npm install

# 2. Configurar variables de entorno
cp .env.local.example .env.local
# Completar las claves según .env.local.example

# 3. Levantar servidor de desarrollo
npm run dev
```

El servidor queda disponible en `http://localhost:3000`.

### Variables de entorno requeridas

Ver `.env.local.example` para la lista completa. Las mínimas para correr el chat:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_INSFORGE_PROJECT_ID` | ID del proyecto en InsForge |
| `NEXT_PUBLIC_INSFORGE_URL` | URL del backend InsForge |
| `INSFORGE_SERVICE_ROLE_KEY` | Clave admin InsForge (solo server-side) |
| `ANTHROPIC_API_KEY` | Clave API de Anthropic (Claude) |

Para RAG y embeddings también se requieren `OPENAI_API_KEY` y las variables de Qdrant.

---

## Scripts

```bash
npm run dev          # Servidor de desarrollo con Turbopack
npm run build        # Build de producción
npm run type-check   # Verificación de tipos TypeScript
npm run lint         # ESLint
```

---

## Licencia

Copyright (c) 2026 EdificIA. Todos los derechos reservados.

Este repositorio es público solo con fines de portafolio y evaluación. No se otorga ninguna licencia de uso, copia o derivación. Ver [LICENSE](./LICENSE) para el texto completo.
