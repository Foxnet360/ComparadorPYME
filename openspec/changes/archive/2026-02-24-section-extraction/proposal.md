# Extracción de Secciones de Clausulados

## Why

Un clausulado típico tiene 50-200 páginas, pero para el análisis solo necesitamos 3 secciones: Exclusiones, Deducibles y Garantías. Enviar el documento completo desperdicia ~80% de los tokens.

## What Changes

- Procesamiento inteligente de clausulados para extraer secciones clave
- Uso de IA para identificar y segmentar las secciones relevantes
- Almacenamiento estructurado por secciones

## Capabilities

### New Capabilities

- `section-extraction`: Extrae Exclusiones, Deducibles y Garantías de clausulados

### Modified Capabilities

- `clause-storage`: Almacena secciones indexadas además del texto completo

## Impact

- `server/src/services/sectionExtractor.ts`: [NEW] Extracción de secciones
- `server/src/services/clauseLibrary.ts`: Añadir almacenamiento de secciones

## Out of Scope

- UI de visualización de secciones (puede ser mejora futura)
- Extracción de secciones adicionales

## Dependencies

- Requiere `clause-library` completado
