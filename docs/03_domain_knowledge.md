# Conocimiento de Dominio (Motor de Auditoría Dinámico)

Este documento define la lógica fundacional del motor de cálculo. **IMPORTANTE: Los valores numéricos extraídos de los proyectos legados NO son valores absolutos ni leyes universales.** Son ejemplos del contexto de un proyecto específico. 

El objetivo del "Gemini Corporativo" es ser un **Motor de Auditoría Dinámico y Agnóstico** capaz de adaptarse a cualquier legajo que se le suba.

## 1. El Concepto del Motor de Reglas Dinámicas y Aprendizaje Continuo
El sistema **no impone matemáticas rígidas**. No asume que existe una única forma correcta de hacer presupuestos. Por el contrario, el motor es agnóstico y **aprende la forma de trabajo única de cada empresa**:

1. **Ingesta Multimodal sin Restricciones**: La IA puede procesar Excels, Words, PDFs, planos CAD o incluso FOTOS de planillas físicas.
2. **Aprendizaje del Contexto de Empresa**: La IA analiza el histórico de archivos subidos por una empresa específica para "aprender" sus costumbres matemáticas (ej. cómo esa empresa suele redondear, qué porcentajes considera normales, cómo estructuran sus subcontratos).
3. **Ingesta de Reglas por Proyecto**: Si el usuario sube un pliego de licitación nuevo, la IA deduce las reglas específicas temporales para ese proyecto.

## 2. Flexibilidad Total de Auditoría y Salida
El sistema usará el proyecto legado solo como un ejemplo remoto de validaciones lógicas posibles (incidencias, exclusión lógica), pero jamás como ley. 
- La IA auditará el presupuesto según el estilo de la empresa.
- **Output a Medida**: Devolverá el resultado en el formato exacto que el usuario pida en el chat, respetando plantillas corporativas o formatos crudos.

- **Chequeo de Incidencias Relativas**: Capacidad de validar si la suma de un subgrupo de ítems (ej. subcontratos) representa un porcentaje "X" del costo directo.
- **Validaciones de Exclusión Lógica**: Capacidad de detectar incongruencias estructurales (ejemplo: detectar si un ítem subcontratado completo reporta "Mano de Obra" interna, lo cual suele ser un error contable).
- **Sumatorias y Cierres**: Validar que los subtotales (porcentuales y monetarios) cierren perfectamente en un total general, resolviendo problemas de redondeo.

## 3. Contexto Comercial ("Fuga de Rentabilidad")
- **Concepto Core**: "Fuga de Rentabilidad". Las tareas administrativas manuales (remitos, procesamiento de planillas) generan horas perdidas que equivalen a dinero no facturado.
- **Impacto Visual**: El sistema debe tener la capacidad de calcular las horas/dinero perdidas por ineficiencias y mostrarle al usuario su equivalencia en proyectos reales (ej. "Honorarios equivalentes a 3 viviendas").
