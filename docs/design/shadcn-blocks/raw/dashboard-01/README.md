# @shadcn/dashboard-01

Referencia consultada con:

```bash
npx shadcn search @shadcn --query dashboard --limit 30
npx shadcn view @shadcn/dashboard-01
npx shadcn add @shadcn/dashboard-01 --dry-run -y
```

## Resumen

- Tipo: `registry:block`
- Descripcion upstream: dashboard con sidebar, charts y data table.
- Uso en EdificIA: referencia de arquitectura visual para bloques densos de datos, no import productivo directo.

## Resultado del dry-run

El bloque completo intentaba crear 34 archivos en `src/` e incorporar dependencias nuevas:

- `@dnd-kit/*`
- `@tanstack/react-table`
- `next-themes`
- `sonner`
- `vaul`
- `recharts@3.8.0`

Decision: no instalar el bloque completo. Se instalaron solamente primitives shadcn sin dependencias nuevas (`card`, `badge`, `tabs`, `table`, `select`, `dropdown-menu`, `tooltip`, `separator`, `skeleton`, `input`, `label`, `checkbox`, `sheet`, `avatar`) y se adapto el patron a bloques propios de EdificIA.
