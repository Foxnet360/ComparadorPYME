## 1. Frontend & Visualización de Deducibles

- [x] 1.1 Invertir prioridad de formateo de deducibles en `VariableComparisonMatrix.tsx` para renderizar `deductible.normalized` antes de `deductible.rawText` con fallback limpio.
- [x] 1.2 Corregir tooltips recortados en `DeductibleBadge.tsx` ajustando estilos CSS (`relative z-50`) o coordenadas para evitar clipping en scroll lateral.

## 2. Robustez de Clausulados y Formatos (Backend)

- [x] 2.1 Definir e inyectar `StructuredClauseSchema` mediante `responseSchema` en `structuredClauseExtractor.ts` para erradicar el parseo por regex frágiles sobre texto libre.
- [x] 2.2 Refactorizar `quoteProcessingService.ts` en la fase 1.5 para buscar marcas clave de aseguradoras en los primeros 1000 caracteres de `nativeText` nativo como identificador prioritario frente al nombre del archivo físico.

## 3. Doble Extracción Anti-Alucinaciones (Backend)

- [x] 3.1 Reemplazar el simulador regex `extractFromRawText` en `dualExtractionService.ts` por una llamada API secundaria real e independiente a Gemini para extraer coberturas críticas.
- [x] 3.2 Implementar contraste automático de valores de Incendio y RC entre las dos extracciones y gatillar alertas en UI si se detecta discrepancia >20%.

## 4. Pruebas & Verificación de Cambios

- [x] 4.1 Ejecutar suite de pruebas unitarias (`deductibleParser.test.ts`) - 20 tests passed
- [x] 4.2 Validación manual requerida: Cargar cotizaciones con nombres genéricos para probar detección robusta de formato
