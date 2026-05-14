# Roadmap de Visión Futura — EdificIA

> **Última auditoría de estado**: 2026-05-13
> 
> Leyenda: ✅ = Hecho | 🔶 = Parcial | ❌ = Pendiente

Este documento captura las ideas de mayor impacto que **NO están en el MVP actual**, ordenadas por viabilidad técnica y valor de negocio.

---

## 🟢 Corto plazo (próximos sprints)

### ✅ Historial de sesiones
- ✅ Guardar y listar sesiones de auditoría anteriores por empresa (tabla `chat_sessions`, `/api/sessions`).
- ✅ Sidebar con historial clickeable que restaura conversaciones.
- ❌ Comparar presupuestos entre proyectos ("este rubro subió 12% respecto al proyecto anterior").

### ❌ Soporte DWG nativo
- **Estado actual**: Solo DXF (formato abierto). DWG es binario propietario de Autodesk.
- **Opciones técnicas**:
  - **Open Design Alliance (ODA)**: SDK C++ con bindings JS — complejo pero gratuito para apps no comerciales
  - **LibreCAD**: conversión DWG→DXF server-side (Docker container)
  - **Aspose.CAD Cloud API**: conversión paga, más fácil de integrar
- **Decisión recomendada**: LibreCAD en container para primer approach.
- **Estado**: No iniciado. DWG se rechaza con mensaje de guía al usuario.

### ❌ PDF escaneados (OCR)
- ✅ Los PDF escaneados ya se detectan como `isScanned=true` en el file-processor.
- ❌ Integrar Tesseract.js (browser) o Google Cloud Vision para extraer texto de imágenes.
- **Estado**: Detección funciona, OCR no implementado.

---

## 🟡 Mediano plazo

### ✅ Visor CAD en browser
- ✅ Renderizar DXF en el cliente usando `dxf-viewer` (Three.js/WebGL based).
- ✅ `DxfViewerModal.tsx` con dynamic import, blob URL, auto-fit, Escape para cerrar.
- ✅ Botón "Ver plano" (ojo) en FileCard para DXF.
- **Estado**: Completado y funcional.

### ❌ Conexión bidireccional con AutoCAD / BricsCAD
- **Concepto**: El agente propone cambios ("las columnas deben aumentar de sección 30×30 a 35×35"), el usuario aprueba, y el sistema aplica el cambio directamente en el CAD.
- **Cómo funciona**:
  1. AutoCAD tiene una API COM (Windows) y una API REST moderna (AutoCAD Web API)
  2. BricsCAD tiene una API similar + soporte LiSP/BricsScript
  3. El agente genera las instrucciones de modificación en formato DXF delta
  4. El usuario aprueba en el chat → el sistema aplica el delta al archivo original
- **Prerequisito**: visor CAD en browser ✅ (ya hecho).
- **Estado**: No iniciado.

---

## 🔴 Largo plazo (alto impacto, alta complejidad)

### ❌ Generación de CAD desde descripción
> "Generá un plano de estructura para una vivienda unifamiliar de 80m2, losa maciza, 2 dormitorios, zona sísmica Z3."

- **Approach**: GPT-4 / Claude genera código Python `ezdxf` o `DXF scripting` → ejecutar en sandbox → devolver archivo DXF
- **Viabilidad**: Alta técnicamente, pero requiere validación por un ingeniero estructural.
- **Modelo de negocio**: Feature premium — "Gemini Design".
- **Estado**: No iniciado.

### ❌ BIM / IFC Integration
- IFC es el estándar abierto para Building Information Models (3D).
- Librerías: `IfcOpenShell` (Python) o `web-ifc` (JS/WASM)
- El agente podría leer un modelo BIM y extraer automáticamente: áreas, volúmenes, cantidades de materiales → computo métrico instantáneo.
- **Esta feature elimina el trabajo manual de agrimensores.**
- **Estado**: No iniciado.

### ❌ Cómputo Métrico Automático desde DXF
- ✅ El DXF ya se parsea y se extraen entidades, capas, bloques.
- ❌ Con geometría: calcular áreas de muros, volúmenes de excavación, longitudes de cañerías automáticamente.
- ❌ El agente propone el cómputo → usuario revisa → genera presupuesto preliminar.
- **Impacto**: De "horas de trabajo manual" a "30 segundos".
- **Estado**: Parser existe, cálculo geométrico no implementado.

### ❌ Fuga de Rentabilidad — Dashboard BI
- Cálculo de horas administrativas perdidas vs valor en proyectos equivalentes.
- "Tu empresa pierde 12 horas/semana en tareas que nosotros automatizamos = 3 honorarios de vivienda/año".
- Dashboard visual con métricas de eficiencia.
- **Estado**: No iniciado. `recharts` está instalado para cuando se necesite.

---

## Decisiones de arquitectura para el futuro

| Feature | Tecnología recomendada | Complejidad | Estado |
|---|---|---|---|
| DWG nativo | LibreCAD Docker + conversión | Media | ❌ |
| OCR PDF escaneado | Tesseract.js / Google Vision | Baja | ❌ |
| Visor CAD browser | dxf-viewer + Three.js | Media | ✅ |
| Edición CAD bidireccional | AutoCAD Web API / DXF delta | Alta | ❌ |
| Generación CAD desde texto | ezdxf en sandbox Python | Alta | ❌ |
| BIM/IFC | web-ifc (WASM) | Alta | ❌ |
| Cómputo automático DXF | Parser geométrico custom | Alta | ❌ |
| Dashboard BI rentabilidad | recharts (ya instalado) | Media | ❌ |
| Comparar presupuestos | Queries SQL + UI diff | Media | ❌ |
