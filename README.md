# EdificIA

> Sistema de Operaciones Autónomo para la Construcción (Autonomous Construction OS).

EdificIA es un **Entorno Operativo Unificado** de alta seguridad diseñado exclusivamente para constructoras. Supera el concepto tradicional de software de gestión al incorporar un **Project Manager Digital** nativo, capaz de anticipar y gestionar la realidad del terreno. Los equipos de ingeniería, arquitectura y capataces pueden auditar presupuestos, controlar seguridad (HSE), gestionar cronogramas y recibir alertas algorítmicas de riesgos climáticos o de logística — todo mediante lenguaje natural y una capa de **UI Generativa** adaptada al contexto estricto de cada obra.

---

## Capacidades Principales

- **Gestión Proactiva de Obra** — Alertas de clima, vencimientos de seguros de subcontratistas (ART), cronograma de tareas y seguimiento de acopios críticos.
- **UI Generativa en el Chat** — El agente no solo responde con texto, sino que renderiza de forma nativa bloques visuales interactivos: métricas y gráficos de barras, tablas comparativas (ranking de proveedores), visores de planos (media grid) y cronogramas tipo Gantt.
- **Contexto Empresarial Conectado** — Evolución de la base documental hacia una capa segura de lectura sobre drives, ERPs, exports y sistemas internos de la constructora. El objetivo es detectar obras activas, clasificar documentos, construir contexto de empresa y auditar riesgos transversales.
- **Generación Autónoma de Documentos** — Produce informes en PDF, memorias descriptivas (.docx) y presupuestos exportables a Excel (.xlsx).
- **Dashboard Integral** — Vista completa por obra que consolida cobertura documental, contactos, agenda y certificaciones.
- **Seguridad Multi-Tenant** — Aislamiento total de datos por constructora con Row-Level Security, ideal para consultores que operan con múltiples firmas.
- **Persistencia Cross-Device** — Las sesiones de chat se sincronizan entre dispositivos vía base de datos.

---

## Documentación y Planificación

- 📌 **[ROADMAP.md](./ROADMAP.md)**: Roadmap consolidado — pendientes técnicos, mejoras estratégicas del agente y orden recomendado.
- 📚 **[/docs](./docs)**: Documentación de arquitectura, dominio y stack.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) · TypeScript strict |
| UI | Shadcn UI · Tailwind CSS v4 · Framer Motion |
| Data fetching | TanStack Query v5 |
| Validación | Zod v3 — schemas compartidos E2E |
| AI / Agente | Vercel AI SDK v6 · DeepSeek (OpenAI-compatible) |
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
| `DEEPSEEK_API_KEY` | Clave API de DeepSeek |

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
