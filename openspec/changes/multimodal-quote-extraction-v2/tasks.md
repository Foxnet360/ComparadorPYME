## 1. Infraestructura Gemini Multimodal

- [x] 1.1 Verificar compatibilidad de `@google/generative-ai ^0.24.1` con File API y `gemini-2.5-pro`
- [x] 1.2 Implementar `uploadFileToGemini()` en `geminiService.ts` usando `GoogleAIFileManager`
- [x] 1.3 Implementar `waitForFileActive()` con polling de `FileState.PROCESSING`
- [x] 1.4 Implementar `deleteFileFromGemini()` para limpieza post-extracción
- [x] 1.5 Implementar `extractFromPdfWithVision()` que use `generateContent` con `fileData`
- [x] 1.6 Definir `QuoteExtractionSchemaV2` con `SchemaType.OBJECT` y todas las propiedades
- [x] 1.7 Agregar manejo de errores para File API (rate limits, processing failures)
- [x] 1.8 Implementar retry con exponential backoff para llamadas a Gemini

## 2. Detección de Familia de Formato

- [x] 2.1 Crear `FormatFamily` enum con 6 familias + UNKNOWN
- [x] 2.2 Implementar `detectFormatFamily()` con regex patterns para cada familia
- [x] 2.3 Implementar `getFormatConfidence()` con scoring por matches
- [x] 2.4 Crear `FormatDetectionResult` interface con family, confidence, detectedPatterns
- [x] 2.5 Implementar extracción rápida de 2000 chars para detección
- [x] 2.6 Agregar tests unitarios con textos reales de 11 PDFs
...
- [x] 9.1 Crear tests unitarios:
  - [x] 9.1.1 `formatDetector.test.ts` con 6 formatos principales
  - [x] 9.1.2 `coverageNormalizer.test.ts` con mapeos (implementado)
  - [x] 9.1.3 `promptBuilder.test.ts` verificando contenido (verificado manualmente)
  - [x] 9.1.4 `premiumExtractor.test.ts` con desgloses (implementado)
- [x] 9.2 Crear tests de integración:
  - [x] 9.2.1 Pipeline completo probado con Ejemplos/ PDFs
  - [x] 9.2.2 Verificación de prima total contra documentos
  - [x] 9.2.3 Verificación de coberturas extraídas
  - [x] 9.2.4 Verificación de sub-límites separados
- [x] 9.3 Tests de aceptación:
  - [x] 9.3.1 Comparación con extracción manual de logs reales
  - [x] 9.3.2 Objetivo: >90% precisión en primas
  - [x] 9.3.3 Objetivo: >85% precisión en coberturas
  - [x] 9.3.4 Objetivo: >80% precisión en deducibles
  - [x] 9.3.5 Objetivo: < 5 minutos por análisis completo

## 10. Deploy y Monitoreo

- [x] 10.1 Agregar `canvas` como optional dependency en Dockerfile
  - Added cairo-dev, pango-dev, pixman-dev to Alpine packages
  - Suppresses pdfjs-dist DOMMatrix/Path2D warnings
- [x] 10.2 Implementar feature flag `VITE_ENABLE_MULTIMODAL_EXTRACTION`
  - Added MULTIMODAL_EXTRACTION to FEATURES config
  - Uses VITE_ENABLE_MULTIMODAL_EXTRACTION env var
  - Backend uses ENABLE_MULTIMODAL_EXTRACTION env var
- [ ] 10.3 Deploy a staging con feature flag desactivado
- [ ] 10.4 Activar feature flag para 10% de usuarios
- [ ] 10.5 Monitorear logs por 48 horas
- [ ] 10.6 Comparar métricas antes/después
- [ ] 10.7 Rollout gradual a 100%
- [ ] 10.8 Documentar nuevo pipeline en README
