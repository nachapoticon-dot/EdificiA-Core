# Tareas Pendientes para Claude

Este documento recopila los errores encontrados y las nuevas características o mejoras que deben ser implementadas en el proyecto. 

## 🐛 Errores a Corregir
- **Error al generar Excel**: El agente se queda "trabado" (no finaliza la respuesta ni muestra el archivo) cuando se le pide que genere un archivo Excel limpio o modificado. El flujo se interrumpe después del mensaje inicial de intención (por ejemplo, después de decir "voy a buscar en la base documental... y de paso armo la estructura"). Posible fallo silencioso en la tool de exportación o en la cadena de LLM al usar la tool `buscar_en_base_documental` combinada con la generación.

## ✨ Mejoras y Cosas a Agregar
- **Selector/Card de Organización Dinámico**: Implementar de forma real el componente de organización (ej. "Estudio Argañaraz"). *Nota de UI: Este es el componente que actualmente se encuentra ubicado arriba a la izquierda en el layout principal.* No debe ser un menú desplegable, sino mostrar esta información directamente a simple vista tomando los datos de la base de datos: el rol del usuario (ej. "FOUNDER"), la cantidad de obras/proyectos activos (ej. "3 obras activas") y la cantidad total de miembros en la organización (ej. "24 miembros").
- **Tarjeta de Obra Activa**: Implementar de forma real el componente de "OBRA ACTIVA" ubicado justo debajo de la tarjeta de Organización. Este componente debe mostrar datos dinámicos de la obra seleccionada:
  - Título de la obra (ej. "Las Lomas - Torre A").
  - Estado o etiqueta visual (ej. "EN OBRA" en verde).
  - Detalles textuales: Código (ej. "LL-2024-01"), Ubicación (ej. "Tigre, BA") y Contrato (ej. "$128.45M").
  - **Cobertura Documental**: La barra de progreso y el porcentaje (ej. "78%") deben reflejar **el espacio de almacenamiento consumido/restante que tiene esa empresa en nuestro servidor**, y no un porcentaje de archivos de la obra en sí.
- **Íconos de Acción (Búsqueda y Configuración)**: Agregar en la esquina superior derecha de la interfaz general (layout) los íconos interactivos de **Buscar** (lupa) y **Configuración** (engranaje), listos para conectarse con sus respectivas funcionalidades futuras.
- **Rediseño de Tarjetas de Documentos Subidos**: Actualizar el componente visual de los archivos subidos para que adopte una estética refinada (que se adapte correctamente al modo claro u oscuro, sin forzar el fondo oscuro si el sistema está en modo claro). Debe mostrar:
  - Ícono del archivo a la izquierda (ej. ícono verde para Excel).
  - Nombre del archivo en la parte superior (ej. `PRESUPUESTO_LAS_LOMAS_R3.xlsx`).
  - Una fila de metadatos sutil debajo, usando tipografía monoespaciada o color tenue para contraste. Estos metadatos deben conectarse con la data real que se extrae al procesar el archivo:
    - **Cantidad de ítems**: El número de filas/elementos detectados (ej. `247 ítems`).
    - **Nombre de la hoja o sección**: La ubicación principal dentro del archivo (ej. `hoja "COMPUTO"` en el caso de Excel).
    - **Monto total**: El valor monetario total identificado en el documento (ej. `$128.450.000`).
- **Componentes de UI Generativa (Generative UI Blocks)**: Mejorar el agente IA para que, además del texto, renderice de forma nativa bloques visuales interactivos en el chat cuando el contexto lo amerite. Se han identificado 4 bloques de la demo de diseño que deben volverse funcionales:
  1. **Bloque de Métricas e Incidencias (Gráficos de Barra)**: Para mostrar desgloses (ej. "Incidencia por rubro"). Debe incluir KPIs superiores (Total de obra, Avance, Desvíos) y una lista de barras horizontales mostrando porcentajes y valores monetarios.
  2. **Bloque de Ranking (Comparativa)**: Para cotejar proveedores o materiales. Es una lista rankeada que muestra etiquetas ("RECOMENDADO"), precios, plazos de entrega, estado IRAM, obras previas y una barra visual de "Score".
  3. **Bloque de Legajo Gráfico (Media Grid)**: Un visor para planos e imágenes. Muestra miniaturas organizadas con etiquetas flotantes (ej. `PLANO`, `INSPECCIÓN`, `RENDER`) y metadatos del archivo en la parte inferior (fecha, vista, extensión).
  4. **Bloque de Cronograma (Timeline)**: Para avances de obra. Presenta un eje de meses arriba, tareas apiladas con barras verdes indicando progreso, una línea vertical naranja marcando el día de "HOY", y un detalle inferior con los hitos (fechas clave).
  *(Importante: En todos estos bloques, el agente debe mostrar antes una lista tipo consola de las herramientas usadas con sus checkmarks verdes, ej: "✅ Calculando totales del presupuesto... ok").*
