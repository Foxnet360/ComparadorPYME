# Optimización de Extracción de Texto en PDFs

## Why

El sistema actual envía PDFs completos a Gemini File API, que los procesa como imágenes (~258 tokens/página). Dado que las cotizaciones son PDFs de texto nativo (no scans), esto es ineficiente: pagamos por "ver" texto que podríamos "leer".

**Impacto actual:** Un análisis típico (3 cotizaciones + 1 clausulado) consume ~41,000 tokens de entrada cuando podrían ser ~14,000.

## What Changes

- **Backend:** Extracción de texto de PDFs antes de enviar a Gemini
- **Prompts:** Ajuste para trabajar con texto plano estructurado
- **Procesamiento:** Eliminación de dependencia en File API para PDFs de texto

## Capabilities

### New Capabilities

- `pdf-text-extraction`: Extrae texto plano de PDFs usando pdf-parse en Node.js

### Modified Capabilities

- `quote-analysis`: Usa texto extraído en lugar de archivo binario para el análisis IA

## Impact

- `server/src/services/gemini.ts`: Modificar `analyzeQuotes()` para recibir texto, no files
- `server/src/controllers/analysisController.ts`: Agregar paso de extracción pre-análisis
- `server/package.json`: Agregar dependencia `pdf-parse`

## Out of Scope

- Context Caching de clausulados frecuentes (cambio futuro)
- RAG local con embeddings (cambio futuro)
- Procesamiento de PDFs escaneados/imágenes (requiere OCR diferente)
