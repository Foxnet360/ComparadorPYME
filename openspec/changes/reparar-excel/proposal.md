## Why

La función de exportación a Excel en el comparador de seguros falla debido a una desestructuración incompleta del hook de notas en el frontend (`cellNotes` es `undefined` al intentar usar `Object.entries()`), y a una potencial falla en el backend por falta de validación de tipos al formatear ratios numéricos de deducibles.

## What Changes

- **Frontend**: Corregir la desestructuración de `useCellNotes()` en `UnifiedCoverageMatrix.tsx` para incluir el estado `cellNotes`.
- **Backend**: Agregar una validación preventiva de tipo string en `excelGenerator.ts` antes de invocar la función `.replace` al procesar celdas de tipo `% SOBRE VALOR ASEGURADO`.

## Capabilities

### New Capabilities

- `reparar-excel`: Corrección del error de exportación a Excel en el frontend y backend.

### Modified Capabilities

*(Ninguna)*

## Impact

- **Frontend**: [UnifiedCoverageMatrix.tsx](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/components/UnifiedCoverageMatrix.tsx)
- **Backend**: [excelGenerator.ts](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/server/src/services/excelGenerator.ts)
