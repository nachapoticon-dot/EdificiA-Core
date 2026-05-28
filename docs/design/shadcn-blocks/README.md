# Shadcn Blocks Inbox

Este directorio es la bandeja de entrada para bloques Shadcn externos que queremos usar como referencia o adaptar a EdificIA.

## Como pegar bloques

1. Crear una carpeta por bloque en `raw/`:

   ```text
   docs/design/shadcn-blocks/raw/nombre-del-bloque/
   ```

2. Dentro de esa carpeta pegar los archivos originales exportados:

   ```text
   component.tsx
   data.ts
   styles.css
   README.md
   screenshot.png
   ```

3. Registrar el bloque en `manifest.json`.

## Reglas

- `raw/` es referencia externa. No se importa desde `src/` y puede tener dependencias faltantes.
- `adapted/` contiene versiones ya revisadas para EdificIA, pero siguen siendo staging.
- El código productivo vive en `src/components/`.
- Antes de usar un bloque en producto, adaptarlo a:
  - Tailwind v4 y tokens existentes de `src/app/globals.css`.
  - Shadcn local de `src/components/ui/`.
  - Iconos `lucide-react`.
  - Accesibilidad y responsive real.
  - Identidad visual de EdificIA, sin copiar layouts genéricos si no calzan con construcción.
- No instalar dependencias nuevas por un bloque sin autorización.

## Estado actual

- `raw/dashboard-01/`: referencia consultada con `npx shadcn view @shadcn/dashboard-01`; no se aplico el bloque completo porque agregaba dependencias nuevas y escribia sobre rutas productivas genericas.
- `adapted/operational-risk-ledger/`: adaptacion productiva en bloques propios de EdificIA (`RiskRegisterBlock`, `EvidenceLedgerBlock`) usando primitives shadcn locales.
- Primitives instalados por CLI: `card`, `badge`, `tabs`, `table`, `select`, `dropdown-menu`, `tooltip`, `separator`, `skeleton`, `input`, `label`, `checkbox`, `sheet`, `avatar`.

## Convencion sugerida

```text
raw/
  analytics-kpi-grid/
    component.tsx
    screenshot.png
adapted/
  analytics-kpi-grid/
    EdificiaKpiGrid.tsx
notes/
  analytics-kpi-grid.md
```
