## Why

Las cotizaciones de seguros PYME presentan las mismas coberturas con nombres diferentes entre aseguradoras (ej: "Responsabilidad Civil", "RC Daños a Terceros", "RCE"). Actualmente el sistema las muestra en filas separadas en la matriz de comparación, dificultando la evaluación. Se requiere un mapeo semántico de 4 capas para unificar coberturas equivalentes bajo 14 categorías canónicas, mejorando la legibilidad y utilidad del comparador.

## What Changes

- **Nuevo servicio de mapeo semántico** (`semantic-matcher`): Sistema en 4 capas (thesaurus exacto → fuzzy Levenshtein → embedding similarity → LLM fallback) que asigna cada cobertura extraída a una categoría canónica con score de confianza
- **Extensión del contrato de datos**: Cada `ParsedCoverage` incluirá `canonicalName`, `categoryId` (1-14), `matchConfidence` (0-1), y `matchMethod` (thesaurus/fuzzy/embedding/llm)
- **Nueva visualización de matriz unificada**: El frontend renderizará exactamente 14 filas fijas (una por categoría de la Plantilla PYME) más una sección "Coberturas No Categorizadas" para matches con confianza < 0.6
- **Indicadores de confianza visuales**: Badges de color (verde ≥0.9, amarillo 0.7-0.89, rojo <0.7) y tooltips con el nombre original de la cobertura
- **BREAKING**: El formato de salida de `/api/analyze` cambia: `coverages` ahora incluye campos de mapeo semántico. El frontend debe actualizar `ComparisonReport.tsx` para usar `canonicalName` en lugar de `normalizeText()` para agrupación

## Capabilities

### New Capabilities
- `semantic-coverage-matching`: Mapeo de nombres de cobertura extraídos de cotizaciones a 14 categorías canónicas usando matching multinivel (thesaurus, fuzzy, embeddings, LLM)
- `unified-coverage-matrix`: Visualización de comparación en matriz de 14 categorías fijas con indicadores de confianza y manejo de coberturas no categorizadas

### Modified Capabilities
- `text-extraction`: Agregar campos de mapeo semántico (`canonicalName`, `categoryId`, `matchConfidence`, `matchMethod`) al output de extracción de cotizaciones

## Impact

- **Backend**: Nuevo `semanticMatcher.ts`, modificación de `quoteParser.ts` para integrar mapeo, actualización de `analysisController.ts` para enriquecer output
- **Frontend**: Refactorización de `ComparisonReport.tsx` (tab Coberturas), posible modificación de `DeductiblesComparisonTable.tsx` para usar categorías canónicas
- **API**: Cambio en el contrato de respuesta de `/api/analyze` (nuevos campos en cada coverage)
- **Dependencias**: Requiere servicio de embeddings existente; no agrega dependencias nuevas
- **Datos**: Los ejemplos en `/Ejemplos` servirán para entrenar/validar el matching
