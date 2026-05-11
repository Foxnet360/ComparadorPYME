## 1. Infraestructura Gemini Multimodal

- [ ] 1.1 Verificar compatibilidad de `@google/generative-ai ^0.24.1` con File API y `gemini-2.5-pro`
- [ ] 1.2 Implementar `uploadFileToGemini()` en `geminiService.ts` usando `GoogleAIFileManager`
- [ ] 1.3 Implementar `waitForFileActive()` con polling de `FileState.PROCESSING`
- [ ] 1.4 Implementar `deleteFileFromGemini()` para limpieza post-extracción
- [ ] 1.5 Implementar `extractFromPdfWithVision()` que use `generateContent` con `fileData`
- [ ] 1.6 Definir `QuoteExtractionSchemaV2` con `SchemaType.OBJECT` y todas las propiedades
- [ ] 1.7 Agregar manejo de errores para File API (rate limits, processing failures)
- [ ] 1.8 Implementar retry con exponential backoff para llamadas a Gemini

## 2. Detección de Familia de Formato

- [ ] 2.1 Crear `FormatFamily` enum con 6 familias + UNKNOWN
- [ ] 2.2 Implementar `detectFormatFamily()` con regex patterns para cada familia
- [ ] 2.3 Implementar `getFormatConfidence()` con scoring por matches
- [ ] 2.4 Crear `FormatDetectionResult` interface con family, confidence, detectedPatterns
- [ ] 2.5 Implementar extracción rápida de 2000 chars para detección
- [ ] 2.6 Agregar tests unitarios con textos reales de 11 PDFs
- [ ] 2.7 Implementar fallback a TEXT cuando ningún patrón coincide

## 3. Prompts Especializados por Familia

- [ ] 3.1 Crear `PromptBuilder` service con templates por familia
- [ ] 3.2 Implementar `buildPromptForFamily(formatFamily, context)`
- [ ] 3.3 Escribir prompt TABLE-DOUBLE (HDI) con instrucciones de página 2
- [ ] 3.4 Escribir prompt TABLE-INTEGRATED (CHUBB) con sub-límites
- [ ] 3.5 Escribir prompt SECTIONS (MAPFRE) con coberturas implícitas
- [ ] 3.6 Escribir prompt DESCRIPTIVE (AXA) con bienes asegurables
- [ ] 3.7 Escribir prompt PRICE-TABLE (SBS) con primas por cobertura
- [ ] 3.8 Escribir prompt TEXT (BOLÍVAR) con búsqueda en todo documento
- [ ] 3.9 Agregar few-shot examples por familia usando PDFs de ejemplo
- [ ] 3.10 Implementar cache de prompts compilados

## 4. Post-Normalización de Coberturas

- [ ] 4.1 Crear `CoverageNormalizer` service
- [ ] 4.2 Implementar `mapRawToCanonical()` con 4 capas (thesaurus, fuzzy, embedding, llm)
- [ ] 4.3 Integrar con `semanticMatcher` existente para capas 1-3
- [ ] 4.4 Implementar `resolveDeductibles()` (específicos → generales)
- [ ] 4.5 Implementar `deriveInsuredAmounts()` de `insuredAssets`
- [ ] 4.6 Implementar `detectImplicitCoverages()` para amparos amplios
- [ ] 4.7 Crear `CanonicalCoverage` interface con status: present｜missing｜excluded
- [ ] 4.8 Implementar `buildCanonicalCoverages()` que produce array de 14
- [ ] 4.9 Agregar confidence scoring por método de matching
- [ ] 4.10 Implementar flags para coberturas que necesitan revisión

## 5. Extracción de Desglose de Primas

- [ ] 5.1 Crear `PremiumExtractor` service (extendiendo existente)
- [ ] 5.2 Implementar `extractPremiumBreakdown()` con 5 componentes
- [ ] 5.3 Implementar `extractPerCoveragePremiums()` del PDF
- [ ] 5.4 Implementar `validatePremiumConsistency()` (suma de componentes)
- [ ] 5.5 Implementar `validatePerCoverageSum()` (primas vs prima neta)
- [ ] 5.6 Agregar soporte para diferentes formatos de moneda (COP, USD)
- [ ] 5.7 Implementar manejo de periodicidad (ANUAL, SEMESTRAL, etc.)

## 6. Actualización de Servicios Existentes

- [ ] 6.1 Modificar `gemini.ts`:
  - [ ] 6.1.1 Agregar `extractFromPdf()` con File API
  - [ ] 6.1.2 Definir `QuoteExtractionSchemaV2`
  - [ ] 6.1.3 Mantener `extractText()` como fallback
  - [ ] 6.1.4 Actualizar manejo de errores
- [ ] 6.2 Renombrar `insurerProfileService.ts` → `formatFamilyService.ts`
  - [ ] 6.2.1 Reemplazar perfiles por prompts de familia
  - [ ] 6.2.2 Actualizar exports y referencias
- [ ] 6.3 Deprecar `quoteParser.ts`
  - [ ] 6.3.1 Mover funciones útiles a `coverageNormalizer`
  - [ ] 6.3.2 Agregar `@deprecated` JSDoc
  - [ ] 6.3.3 Mantener como fallback de emergencia
- [ ] 6.4 Ampliar `thesaurusMapper.ts`
  - [ ] 6.4.1 Agregar variantes encontradas en logs ("Sin deducible", etc.)
  - [ ] 6.4.2 Agregar mapeo de sub-límites a coberturas padre

## 7. Actualización del Controller de Análisis

- [ ] 7.1 Modificar `analysisController.ts`:
  - [ ] 7.1.1 Fase 1: Detectar formato (usar primeros 2000 chars)
  - [ ] 7.1.2 Fase 2: Subir PDF a Gemini
  - [ ] 7.1.3 Fase 3: Extraer con prompt especializado
  - [ ] 7.1.4 Fase 4: Normalizar coberturas
  - [ ] 7.1.5 Fase 5: Validar y comparar
- [ ] 7.2 Implementar pipeline secuencial por cotización (no paralelo)
- [ ] 7.3 Hacer RAG asíncrono (no bloquear extracción principal)
- [ ] 7.4 Agregar timeout de 5 minutos por cotización
- [ ] 7.5 Implementar fallback a extracción texto si File API falla

## 8. Actualización de Tipos y Interfaces

- [ ] 8.1 Actualizar `server/src/types.ts`:
  - [ ] 8.1.1 Agregar `ExtractedQuote` interface
  - [ ] 8.1.2 Agregar `PremiumBreakdown` interface
  - [ ] 8.1.3 Agregar `CanonicalCoverage` interface
  - [ ] 8.1.4 Agregar `FormatFamily` type
- [ ] 8.2 Actualizar `ParsedQuote` para compatibilidad hacia atrás
- [ ] 8.3 Agregar `CoverageItemV2` con premium por cobertura

## 9. Tests y Validación

- [ ] 9.1 Crear tests unitarios:
  - [ ] 9.1.1 `formatDetector.test.ts` con 11 textos reales
  - [ ] 9.1.2 `coverageNormalizer.test.ts` con mapeos
  - [ ] 9.1.3 `promptBuilder.test.ts` verificando contenido
  - [ ] 9.1.4 `premiumExtractor.test.ts` con desgloses
- [ ] 9.2 Crear tests de integración:
  - [ ] 9.2.1 Procesar cada uno de los 11 PDFs
  - [ ] 9.2.2 Verificar prima total coincida con documento
  - [ ] 9.2.3 Verificar todas las coberturas extraídas
  - [ ] 9.2.4 Verificar sub-límites separados
- [ ] 9.3 Tests de aceptación:
  - [ ] 9.3.1 Comparación side-by-side con extracción manual
  - [ ] 9.3.2 Métrica: >90% precisión en primas
  - [ ] 9.3.3 Métrica: >85% precisión en coberturas
  - [ ] 9.3.4 Métrica: >80% precisión en deducibles
  - [ ] 9.3.5 Métrica: < 5 minutos por análisis completo

## 10. Deploy y Monitoreo

- [ ] 10.1 Agregar `canvas` como optional dependency en Dockerfile
- [ ] 10.2 Implementar feature flag `VITE_ENABLE_MULTIMODAL_EXTRACTION`
- [ ] 10.3 Deploy a staging con feature flag desactivado
- [ ] 10.4 Activar feature flag para 10% de usuarios
- [ ] 10.5 Monitorear logs por 48 horas
- [ ] 10.6 Comparar métricas antes/después
- [ ] 10.7 Rollout gradual a 100%
- [ ] 10.8 Documentar nuevo pipeline en README
