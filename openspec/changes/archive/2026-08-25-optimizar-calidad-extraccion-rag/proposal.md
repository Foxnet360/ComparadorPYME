## Why

El pipeline actual de análisis RAG presenta oportunidades significativas de optimización en cuatro frentes: (1) las ventanas cortas de resalte verbatim truncaban cláusulas complejas de sublímites, (2) los deducibles compuestos con combinaciones en UVT/SMMLV/% requerían mayor precisión estructural, (3) el consumo de tokens de entrada en Gemini no aprovechaba Context Caching, y (4) la canonicalización por grafo semántico requería activación controlada por Feature Flag.

Esta propuesta establece las mejoras estructuradas por fases con fallbacks defensivos y riesgo cero de caída del servicio.

## What Changes

- **Ampliación de Ventana de Snippet RAG**: Extender la regla y descripción del esquema `rawTextSnippet` a una ventana de 50-300 caracteres para asegurar la veracidad de cláusulas anidadas.
- **Refino del Parsing de Deducibles Compuestos**: Descomposición precisa en `DeductibleSchema` y `hybridDeductibleParser.ts` preservando fallback a texto plano sin lanzar excepciones.
- **Activación Controlada de Canonicalización por Grafo**: Habilitación progresiva de `useUnifiedGraphCanonicalization` con retroceso automático al tesauro estático si la certeza es menor a 0.7.
- **Integración de Gemini Context Caching**: Creación del mecanismo de caché de contexto (`cachedContent`) para PDFs pesados (>32k tokens) con fallback a la API estándar si la cuota o expiración falla.

## Capabilities

### New Capabilities
- `extraction-quality-optimization`: Optimización de ventana de resalte verbatim (50-300 chars), parsing de deducibles compuestos combinados, integración defensiva de Gemini Context Caching y activación de canonicalización semántica por grafo.

### Modified Capabilities
<!-- No requirement changes to existing base specs -->

## Impact

- **Código Afectado**: `server/src/services/gemini.ts`, `server/src/services/unifiedComparison/comparisonPromptBuilder.ts`, `server/src/services/hybridDeductibleParser.ts`, `server/src/services/coverageNormalizer.ts`, `server/src/config/featureFlags.ts`.
- **Riesgo Operativo**: Muy bajo a controlado. Todas las funciones avanzadas cuentan con Feature Flags o bloques `try/catch` defensivos.
