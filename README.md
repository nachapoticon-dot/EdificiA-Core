# EdificIA

> "EL MEJOR AYUDANTE" a prueba de balas para tu obra. Plataforma de Inteligencia Artificial proactiva para empresas constructoras.

EdificIA es un SaaS B2B multi-tenant que no solo actúa como la memoria institucional de una constructora, sino como un **asistente proactivo** que gestiona la realidad del terreno. Los equipos de ingeniería, arquitectura y capataces pueden auditar presupuestos, controlar seguridad (HSE), gestionar cronogramas y recibir alertas inteligentes — todo mediante lenguaje natural y **UI Generativa**, adaptado al contexto de cada obra.

---

## Capacidades Principales

- **Gestión Proactiva de Obra** — Alertas de clima, vencimientos de seguros de subcontratistas (ART), cronograma de tareas y seguimiento de acopios críticos.
- **UI Generativa en el Chat** — El agente no solo responde con texto, sino que renderiza de forma nativa bloques visuales interactivos: métricas y gráficos de barras, tablas comparativas (ranking de proveedores), visores de planos (media grid) y cronogramas tipo Gantt.
- **RAG Jerárquico** — Sistema de recuperación semántica sobre PDFs, planillas Excel, planos DXF e imágenes, indexados por empresa y obra.
- **Generación Autónoma de Documentos** — Produce informes en PDF, memorias descriptivas (.docx) y presupuestos exportables a Excel (.xlsx).
- **Dashboard Integral** — Vista completa por obra que consolida cobertura documental, contactos, agenda y certificaciones.
- **Seguridad Multi-Tenant** — Aislamiento total de datos por constructora con Row-Level Security, ideal para consultores que operan con múltiples firmas.
- **Persistencia Cross-Device** — Las sesiones de chat se sincronizan entre dispositivos vía base de datos.

---

## Documentación y Planificación

Para mantener la raíz del proyecto ordenada, toda la documentación de avance, auditorías y tareas para el equipo de desarrollo/IA se encuentra en el directorio `/docs`:
- 📌 **[Plan de Mejora y Roadmap](./docs/planning/PLAN_DE_MEJORA.md)**: Hoja de ruta estratégica, arquitectura de "El Mejor Ayudante" y despliegue.
- 📝 **[Tareas para Claude](./docs/planning/TAREAS_CLAUDE.md)**: Registro de bugs y requerimientos de UI a implementar en las próximas iteraciones.

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
