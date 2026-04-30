## Why

El análisis actual de cotizaciones colapsa cuando se procesan 3+ cotizaciones porque fuerza a Gemini a generar un JSON enorme (14 coberturas × N cotizaciones + scoring + alerts + análisis) en una sola llamada. Esto excede el límite de tokens de salida y produce JSON truncado. La lógica de negocio requiere procesar cotizaciones por separado de los clausulados, permitiendo análisis incremental y robusto.

## What Changes

- Dividir el análisis de cotizaciones en **3 llamadas independientes** a Gemini:
  1. **Extracción**: Extraer datos estructurados de cada cotización (aseguradora, primas, coberturas básicas)
  2. **Scoring**: Calcular scores y generar alerts basados en los datos extraídos
  3. **Narrativa**: Generar recomendación final y análisis de mercado
- Eliminar el procesamiento de clausulados del flujo de cotizaciones (se procesarán en un change futuro)
- Implementar token counting previo para prevenir envíos que excedan límites
- Agregar manejo de fallback por cotización individual si el análisis batch falla

## Capabilities

### New Capabilities
- `multi-call-quote-analysis`: Análisis de cotizaciones dividido en 3 fases (extracción, scoring, narrativa)
- `token-counting`: Pre-cálculo de tokens antes de enviar a Gemini para prevenir truncamiento
- `quote-batch-processor`: Procesamiento de 3-5 cotizaciones con fallback individual

### Modified Capabilities
- `quote-analysis-v2`: La salida del análisis ya no incluye clausulados (solo cotizaciones puras)

## Impact

- **Backend**: `gemini.ts`, `analysisController.ts`, nuevos servicios `quoteExtractor.ts`, `quoteScorer.ts`, `quoteNarrative.ts`
- **Frontend**: Posible barra de progreso mostrando las 3 fases del análisis
- **API**: El endpoint `/api/analyze` seguirá existiendo pero con comportamiento interno diferente
- **Breaking**: La respuesta JSON puede cambiar ligeramente (menos campos anidados, más estructura plana)