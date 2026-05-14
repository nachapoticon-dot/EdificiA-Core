# Guía de Contribución

¡Gracias por tu interés en contribuir a **EdificIA**! 
Este repositorio sigue estrictos estándares de ingeniería de software para asegurar que se mantenga como un producto de grado empresarial.

## 1. El Rol de la IA
Este proyecto se desarrolla mediante una colaboración híbrida (Humano + IA). La IA tiene permisos de Nivel CTO y se rige por su documento maestro `CLAUDE.md`. Si eres una IA leyendo esto, asegúrate de haber leído tu Biblia operativa.

## 2. Flujo de Trabajo (Git Flow)
1. **Nunca** subas código (Push) directamente a la rama `main`.
2. Crea una rama descriptiva para tu tarea: `git checkout -b feature/nombre-de-la-feature` o `bugfix/nombre-del-bug`.
3. Haz commits atómicos (pequeños y centrados en una sola cosa) con mensajes claros (ej. `feat: agregar drag and drop para excels`).
4. Abre un Pull Request (PR) utilizando la plantilla provista (`.github/PULL_REQUEST_TEMPLATE.md`).

## 3. Reglas de Código
- Todo el código debe estar escrito en **TypeScript** estricto.
- Utiliza **Zod** para la validación de esquemas de datos.
- Sigue el patrón de "Responsabilidad Única" (Single Responsibility Principle) en los componentes de React.
- Si agregas una librería nueva o un servicio, **actualiza obligatoriamente** el archivo `docs/04_architecture_map.md`.

## 4. Reporte de Errores
Si encuentras un error, por favor utiliza la pestaña "Issues" de GitHub y selecciona la plantilla de "Bug Report".
