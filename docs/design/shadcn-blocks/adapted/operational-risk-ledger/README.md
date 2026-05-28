# Operational Risk + Evidence Ledger

Adaptacion EdificIA basada en el patron de `@shadcn/dashboard-01`: headers compactos, tabla escaneable, badges de estado y tabs para segmentar datos sin sumar dependencias de tabla avanzada.

## Componentes productivos

- `src/components/chat/blocks/RiskRegisterBlock.tsx`
- `src/components/chat/blocks/EvidenceLedgerBlock.tsx`
- `src/components/chat/blocks/skeletons.tsx`
- `src/lib/validators/blocks.ts`

## Primitives shadcn usados

- `Badge`
- `Table`
- `Tabs`
- `TooltipProvider` en `src/components/providers.tsx`

## Criterio de adaptacion

- No se importa nada desde `docs/design/shadcn-blocks/raw/`.
- No se agregan dependencias nuevas.
- Los bloques usan tokens existentes (`--card`, `--border`, `--warn`, `--cyan`, `--primary`) y lucide icons.
- El contenido esta orientado a obra: riesgos activos, responsables, vencimientos, evidencia citable y conflictos documentales.

## QA visual

Ver en desarrollo:

```bash
npm run dev
# /dashboard/blocks-demo
```
