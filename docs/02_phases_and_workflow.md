# Roadmap de Ejecución (Enfoque a Resultados)

El objetivo de este proyecto es la **entrega de un producto de nivel empresarial**. La IA debe ejecutar estas fases con máxima autonomía y velocidad, sin detenerse por revisiones didácticas intermedias. El usuario consumirá y aprenderá del código finalizado.

## Sprint 1: Fundación y Backend (Autónomo)
- **Acción Crítica**: Conectar MCP de InsForge.
- Levantar el entorno Next.js + TS + Shadcn.
- Aprovisionar la base de datos PostgreSQL y la Autenticación mediante InsForge.
- *Entregable*: Repositorio "Pro" compilando, con CI/CD básico y BD conectada. La IA debe avanzar al Sprint 2 inmediatamente al terminar.

## Sprint 2: Core Chat UI y Motor Lógico
- Implementar Vercel AI SDK para el "Gemini Corporativo".
- Migrar la matemática de `_referencias_legadas/Auditoria_Presupuesto_Construccion` a TypeScript.
- Conectar las funciones matemáticas como "Tools" para el agente de chat.
- *Entregable*: Un chat funcional que puede recibir datos, validarlos con la matemática de construcción, y devolver una respuesta estructurada.

## Sprint 3: Procesamiento de Archivos (Drag & Drop)
- Implementar la UI para subir planillas Excel y extraer información.
- Conectar el flujo de lectura de archivos al agente del chat.
- *Entregable*: El usuario lanza un Excel, el sistema lo audita instantáneamente y guarda el historial en la base de datos de InsForge.

## Sprint 4: Pulido Nivel Producción
- Implementación de las "Features QoL" (modo alto contraste, bitácoras de auditoría, explicaciones en texto plano).
- Corrección de bugs y optimización de promts del LLM.
- *Entregable*: MVP Listo para entrega comercial a empresas.
