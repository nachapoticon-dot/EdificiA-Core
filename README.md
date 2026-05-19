# EdificIA

> Sistema de Operaciones Autónomo para la Construcción (Autonomous Construction OS).

EdificIA es un **Sistema Integral de Gestión** de alta seguridad diseñado exclusivamente para constructoras. Supera el concepto tradicional de software de gestión al incorporar un **Project Manager Digital** nativo, capaz de anticipar y gestionar la realidad del terreno. Los equipos de ingeniería, arquitectura y administración pueden auditar presupuestos, controlar seguridad (HSE), gestionar cronogramas, ordenar expedientes operativos y recibir alertas de riesgos climáticos, documentales o logísticos, todo mediante lenguaje natural y vistas operativas por obra, expediente y empresa.

Estado actual: el producto corre localmente y el deploy público está pausado hasta resolver la URL estable/credenciales de InsForge Deployments. La capa de Inteligencia Empresarial ya converge Radar, Fuentes y Mapa Vivo; los conectores read-only reales (Drive/SharePoint/SQL) quedan como siguiente etapa.

---

## Capacidades Principales

- **Gestión Proactiva de Obra** — Alertas de clima, vencimientos de seguros de subcontratistas (ART), cronograma de tareas, curva financiera, HSE y seguimiento de acopios críticos.
- **Agent Core + Mesa de Expedientes** — El trabajo se organiza como `Empresa -> Obra -> Expediente Operativo -> Eventos/Evidencias/Acciones/Artefactos`, con replay de auditoría, cierre con veredicto y trazabilidad de evidencia.
- **UI Generativa en el Chat** — El agente no solo responde con texto, sino que renderiza de forma nativa bloques visuales interactivos: métricas y gráficos de barras, tablas comparativas (ranking de proveedores), visores de planos (media grid) y cronogramas tipo Gantt.
- **Inteligencia Empresarial** — Radar de Evidencia, Fuentes de Empresa y Mapa Vivo convergen archivos, exports, entidades, patrones, cobertura por obra, relaciones documentales y perfil empresarial reusable por el agente.
- **Fuentes de Empresa** — Carga directa de lotes de PDFs, Excels, DXF, Word, imágenes y exports CSV/XLSX. La arquitectura ya modela fuentes externas read-only para Drive, SharePoint, OneDrive, SQL y ERPs.
- **Generación Autónoma de Documentos** — Produce informes en PDF, memorias descriptivas (.docx) y presupuestos exportables a Excel (.xlsx).
- **Dashboard Integral** — Vista completa por obra que consolida cobertura documental, expedientes recientes, contactos, agenda, certificaciones y brief diario.
- **Observabilidad Operativa** — Alerting local multi-tenant para errores de sistema, con panel admin para listar y resolver eventos críticos.
- **Seguridad Multi-Tenant** — Aislamiento total de datos por constructora con Row-Level Security, ideal para consultores que operan con múltiples firmas.
- **Persistencia Cross-Device** — Las sesiones de chat se sincronizan entre dispositivos vía base de datos.
- **Memoria Activa Confirmada** — El agente puede guardar aprendizajes empresariales solo con confirmación explícita del usuario y evidencia asociada.

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
| Embeddings | NVIDIA NIM / OpenAI-compatible `text-embedding-3-small` |
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
│   │   ├── expedientes/          # Mesa global de expedientes operativos
│   │   ├── contexto/             # Inteligencia Empresarial: Radar, Fuentes y Mapa Vivo
│   │   ├── documents/            # Redirect legacy a contexto/fuentes
│   │   ├── obras/[id]/           # Detalle de obra, brief diario y expedientes
│   │   └── admin/                # Panel: miembros, alertas, patrones, índices, settings
│   └── api/
│       ├── chat/                 # Route handler del agente AI (streaming)
│       ├── generate/             # Generación de informe PDF, memoria DOCX, presupuesto XLSX
│       ├── documents/            # CRUD/reindex de documentos persistidos
│       ├── enterprise-context/   # Radar, perfil empresarial y refresh del Mapa Vivo
│       ├── work-cases/           # Expedientes operativos y acciones de cierre
│       ├── knowledge-graph/      # Dump de relaciones documento/obra/fuente
│       ├── upload/               # Ingesta de archivos y fuentes empresariales
│       ├── indices/              # Índices de precio CAC (append-only)
│       ├── projects/             # CRUD de obras y cobertura documental
│       ├── proactivity/          # Hallazgos vivos del motor proactivo
│       ├── sessions/             # Persistencia de sesiones de chat
│       └── admin/                # Members, alertas, patrones, org settings
├── components/
│   ├── chat/                     # Chat UI: AgentGreeting, OrgSwitcher, FileChip…
│   ├── enterprise-context/       # Fuentes de Empresa y vistas de inteligencia
│   ├── obras/                    # Componentes del dashboard de obras
│   └── ui/                       # Componentes Shadcn
├── hooks/                        # useProjects, useSessionHistory, useOrgMember…
├── contexts/                     # ProjectContext, SessionContext
└── lib/
    ├── agent-core/               # Scope, capacidades y runtime modular del agente
    ├── ai/                       # System prompt y configuración del agente
    ├── enterprise-context/       # Perfil vivo, agregación y lectura para prompt/tools
    ├── document-intelligence/    # Reportes documentales y context scan
    ├── knowledge-graph/          # Relaciones semánticas entre documentos
    ├── observability/            # Captura de errores operativos
    ├── rag/                      # Pipeline RAG: ingest, chunking, retrieval
    ├── embeddings/               # Cliente OpenAI embeddings
    ├── qdrant/                   # Cliente Qdrant + helpers de búsqueda vectorial
    ├── file-processor/           # Procesadores PDF, DOCX, Excel, DXF, imágenes
    ├── math-engine/              # Motor de auditoría de presupuestos
    ├── pattern-extractor/        # Extracción de patrones de documentos
    ├── proactivity/              # Scan diario y read model de hallazgos vivos
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
git clone https://github.com/nachapoticon-dot/EdificiA-Core.git
cd EdificiA-Core
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
| `AUTH_STRICT_MODE` | Opcional. En producción es estricto por defecto; `false` solo para emergencia operativa |
| `DEEPSEEK_API_KEY` | Clave API de DeepSeek |

Para RAG y embeddings también se requieren `OPENAI_API_KEY` y las variables de Qdrant.

---

## Scripts

```bash
npm run dev          # Servidor de desarrollo con Turbopack
npm run build        # Build de producción
npm run type-check   # Verificación de tipos TypeScript
npm run lint         # ESLint
npm test             # Tests unitarios node:test
npm run smoke:chat   # Smoke E2E del runtime conversacional
```

---

## Licencia

Copyright (c) 2026 EdificIA. Todos los derechos reservados.

Este repositorio es público solo con fines de portafolio y evaluación. No se otorga ninguna licencia de uso, copia o derivación. Ver [LICENSE](./LICENSE) para el texto completo.
