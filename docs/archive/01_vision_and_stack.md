# Visión del Producto y Stack Tecnológico

> ⚠️ **DOCUMENTO HISTÓRICO / ARCHIVADO.** Refleja la visión y el stack de la etapa fundacional ("antes Gemini para la Construcción") y ya no describe el producto vigente. La narrativa actual vive en `README.md` (producto + stack real), `docs/06_enterprise_context_layer.md` (contexto empresarial) y `docs/08_agent_core_redesign.md` (modelo Empresa → Obra → Expediente). No usar como referencia operativa.

## Concepto y Filosofía del Producto
**EdificIA** (antes "Gemini para la Construcción"): NO es un sistema rígido de botones disfrazado de chat. Es un **Asistente de Inteligencia Artificial Conversacional General** que tiene "superpoderes" multimodales para la construcción. 

- **Omnivoro de Datos (Multimodal)**: El sistema debe ser capaz de recibir y entender cualquier formato de archivo que la empresa le arroje: **Excel, Word, planos CAD, PDFs, o incluso FOTOS** de planillas escritas a mano o reportes de obra.
- **Salidas Dinámicas**: Debe tener la capacidad de devolver la información en el formato exacto y con el diseño que la empresa solicite por chat (ej. "Devuélveme esto en un PDF con el logo de mi empresa", o "Pásame este presupuesto en formato CSV").
- **Inteligencia General (Preguntas de todo tipo)**: El chat debe poder mantener una conversación natural, responder preguntas simples de ingeniería, dudas de la plataforma, o hasta "preguntas boludas", exactamente igual que ChatGPT o Claude.
- **Superpoderes (Tool Calling)**: Cuando el usuario pide algo complejo (ej: "Revisa este Excel" o "¿Cuál es la norma de instalaciones sanitarias en nuestra empresa?"), la IA usa herramientas internas (Tools) de forma transparente para hacer el cálculo matemático o consultar la base de datos, y luego responde con la misma fluidez conversacional.
Originalmente habíamos planteado separar el backend en Python. **Esto fue un error arquitectónico** considerando tu requerimiento de mantener la app "chiquita y bien definida" y usar **InsForge**. 
Para lograr la máxima eficiencia y evitar microservicios innecesarios, **el stack será 100% TypeScript**. La lógica matemática heredada en Python será migrada a TypeScript usando librerías como `xlsx` o `exceljs`. Esto permite tipado de punta a punta (End-to-End Type Safety) y un solo repositorio cohesivo.

## Stack Tecnológico Definitivo ("Agent-Optimized")

### 1. Frontend (La Interfaz)
- **Framework**: Next.js (App Router) + TypeScript.
- **Data Fetching**: TanStack Query + Next.js Server Actions.
- **Validación**: Zod (mismos esquemas para frontend y backend).
- **UI/UX**: Shadcn UI + TailwindCSS. Diseño premium con Drag & Drop mágico.

### 2. Backend y Arquitectura Multi-Empresa (Multi-Tenant)
- **Plataforma Core**: **InsForge**. BaaS diseñado para agentes IA.
- **Arquitectura SaaS (Multi-tenant)**: El sistema será UN solo software (un solo core codebase) capaz de servir a múltiples empresas constructoras.
- **Seguridad de Grado Empresarial**: Obligatorio implementar RLS (Row-Level Security) en la base de datos PostgreSQL de InsForge para aislar estrictamente los datos, presupuestos y legajos de cada empresa.
- **Autenticación y Storage**: Manejados nativamente por InsForge, asegurando acceso por tokens corporativos.
- **Procesamiento AI**: Vercel AI SDK (TypeScript) para la lógica conversacional. El agente cruzará la información del legajo técnico subido con las bases de datos de conocimiento específicas de esa empresa.

## Features QoL (Quality of Life)
- **Chat Contextual**: Explicaciones humanas de los errores del presupuesto.
- **Ejecución Instantánea**: La IA de chat corrige el archivo y te permite descargar la versión arreglada con un click.
- **Historial (Audit Trail)**: Guardado en la base de datos PostgreSQL de InsForge.
