# Análisis de Cotizaciones v2

## Why

El análisis actual procesa clausulados completos en cada solicitud. Con la biblioteca de clausulados y extracción de secciones, podemos reducir ~90% del costo de tokens usando solo las secciones relevantes pre-indexadas.

## What Changes

- Flujo de análisis modificado para usar biblioteca de clausulados
- Selector de clausulados en UI (en lugar de subir PDFs)
- Prompt optimizado para secciones extraídas

## Capabilities

### Modified Capabilities

- `quote-analysis`: Usa secciones de clausulados de biblioteca en lugar de PDFs completos

### New Capabilities

- `clause-selector-ui`: Selector de clausulados pre-cargados en el flujo de análisis

## Impact

- `server/src/controllers/analysisController.ts`: Usar biblioteca de clausulados
- `server/src/services/gemini.ts`: Ajustar prompt para secciones
- `components/QuoteUploader.tsx`: Añadir selector de clausulados
- `App.tsx`: Integrar nuevo flujo

## Out of Scope

- Context Caching de Gemini (optimización futura)
- Análisis batch de múltiples clientes

## Dependencies

- Requiere `clause-library` completado
- Requiere `section-extraction` completado
