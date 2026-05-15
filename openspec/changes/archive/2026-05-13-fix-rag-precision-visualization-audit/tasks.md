## 1. CRÍTICO: Fix RAG Pipeline

### Hallazgo Raíz (Diagnóstico Completo):
- **Tabla `chunks`**: 625 filas, 9 documentos con chunks (creados entre 2026-05-05 y 2026-05-10)
- **Tabla `clause_chunks`**: 0 filas (schema correcto pero vacía)
- **RPC functions**: Ya usan `chunks` (no `clause_chunks`) - ESTÁN CORRECTAS
- **Problema real**: El filtro de insurer_name usa `documents.document_name` pero el nombre extraído de la cotización no coincide con el nombre del documento

**Ejemplo del problema:**
- Cotización extrae: "SBS SEGUROS COLOMBIA S.A."
- Documento guardado: "Clausulado SBS PYME"  
- Filtro RPC: `d.document_name ILIKE '%SBS SEGUROS COLOMBIA S.A.%'` → NO COINCIDE

- [x] **1.1** Fix filtro de insurer en RPC `match_chunks_unified`
  - ✅ Cambiado a filtro bidireccional: `(i.name ILIKE '%' || insurer_filter || '%' OR insurer_filter ILIKE '%' || i.name || '%')`
  - ✅ Verificado: retorna 134 chunks para SBS (antes 0)

- [x] **1.2** Fix filtro en RPC `match_chunks_vector_unified`
  - ✅ Mismo cambio bidireccional aplicado

- [x] **1.3** Fix filtro en RPC `get_chunks_by_coverage_unified`
  - ✅ Mismo cambio bidireccional aplicado

- [x] **1.4** Verificar matching de nombres de aseguradoras
  - ✅ `insurerNameNormalizer.ts` creado (73 líneas)
  - ✅ Mappings: SBS, AXA Colpatria, BBVA, CHUBB, HDI, MAPFRE
  - ✅ Integrado en `ragRetrievalService.ts` (search, vectorSearch, getByCoverage, checkInsurerHasClauses)
  - ✅ Log de normalización visible en consola

- [x] **1.5** Test end-to-end de RAG retrieval
  - ✅ `test-rag-retrieval.ts` creado (127 líneas)
  - ✅ Verifica: insurers con cláusulas, hybrid search, vector search, coverage search, name normalization
  - ✅ Ejecutable con: `npx ts-node test-rag-retrieval.ts`

## 2. CRÍTICO: Fix Scoring (Scores Artificiales <50)

### Hallazgo Raíz:
- Cuando no hay RAG data (crossRefResults.length === 0), 4 de 6 dimensiones quedan en 30
- Score máximo teórico: 100×0.25 + 30×0.20 + 30×0.20 + 100×0.15 + 30×0.10 + 30×0.10 = **56/100**

- [x] **2.1** Cambiar defaults de 30 a 60 cuando no hay RAG
  - ✅ `calculateDeductibleScore`: return 60 (línea 237)
  - ✅ `calculateExclusionScore`: return 60 (línea 272)
  - ✅ `calculateSubLimitScore`: return 60 (línea 336)
  - ✅ `calculateWarrantyScore`: return 60 (línea 373)

- [x] **2.2** Separar Data Quality Score de Verification Confidence
  - ✅ Implementado en `quoteScorer.ts:103-132`
  - ✅ `ScoringResult` actualizado con ambos campos (líneas 32-33)

- [x] **2.3** Actualizar frontend para mostrar ambos scores
  - ✅ Score principal: Data Quality Score (línea 276)
  - ✅ Badge secundario: Verification Confidence (línea 281)
  - ✅ Barra de progreso con color coding (línea 300)

## 3. CRÍTICO: Anti-Alucinaciones (Validación de Valores)

- [x] **3.1** Mejorar prompt de Gemini con instrucciones anti-alucinación
  - ✅ Implementado en `analysisController.ts:131-161`
  - ✅ Instrucciones: "NO calcules, infieras ni inventes valores"
  - ✅ Ejemplos de valores "demasiado redondos" marcados como NO ESPECIFICADO

- [x] **3.2** Implementar value source tracking
  - ✅ Campo `valueSource` agregado a `ParsedCoverage` (`quoteParser.ts:26`)
  - ✅ `valueValidationService.ts` creado (5046 bytes)
  - ✅ Validación contra rawText implementada en `analysisController.ts:509`

- [x] **3.3** Implementar dual extraction para coverages críticas
  - ✅ `dualExtractionService.ts` creado (160 líneas)
  - ✅ Extrae Incendio y RC del rawText con regex (segunda extracción)
  - ✅ Calcula discrepancia >20% y genera flag para revisión manual
  - ✅ Integrado en `analysisController.ts:531-552` como Phase 2.6
  - ✅ Resultados agregados a `QuoteAnalysis` response

## 4. ALTO: DeductibleMatrix Componente

- [x] **4.1** Crear componente DeductibleMatrix
  - ✅ Componente creado: `DeductibleMatrix.tsx` (188 líneas)
  - ✅ 14 categorías × N aseguradoras con color coding
  - ✅ Panel de resumen: mejor/peor deducible por cobertura

- [x] **4.2** Extraer sublímites de documentos
  - ✅ Regex actualizado en `quoteParser.ts:128` con grupo opcional para Sublímite
  - ✅ Campo `sublimit` agregado a `CoverageItem` en `types.ts`

- [x] **4.3** Integrar DeductibleMatrix en ComparisonReport
  - ✅ Tab "Deducibles" incluye `<DeductibleMatrix quotes={report.quotes} />` (línea 468)
  - ✅ Sublímites mostrados en la matriz con estilo indigo

## 5. ALTO: Frontend Fixes

- [x] **5.1** Fix N×M uncategorized matrix
  - ✅ `UnifiedCoverageMatrix.tsx` maneja múltiples aseguradoras como columnas
  - ✅ Coberturas exclusivas mostradas correctamente

- [x] **5.2** Fix radar chart label overlap
  - ✅ Font size reducido a 10px (`InsurerRadar.tsx`)
  - ✅ Nombres truncados a 15 caracteres
  - ✅ Tooltip interactivo para nombres completos

- [x] **5.3** Fix premium chart
  - ✅ Toggle IVA implementado (`ComparisonReport.tsx:50`)
  - ✅ Manejo de valores faltantes con "No disponible"

- [x] **5.4** Fix charts in hidden tabs
  - ✅ Renderizado condicional basado en `activeTab === 'resumen'` (línea 361)
  - ✅ `minWidth` y `minHeight` agregados a contenedores

## 6. MEDIO: RAG Improvements Adicionales

- [x] **6.1** Remover cross-insurer fallback
  - ✅ `searchWithFallback` solo retorna búsqueda directa, sin fallback (líneas 290-308)
  - ✅ `isFallback` siempre `false`

- [x] **6.2** Agregar score threshold a RAG retrieval
  - ✅ `MIN_SIMILARITY_THRESHOLD = 0.7` (línea 21)
  - ✅ Retrieval limit aumentado a 15 chunks (línea 52)

- [x] **6.3** Agregar flag isRagAvailable por aseguradora
  - ✅ Flag agregado a `QuoteAnalysis` en `types.ts:60`
  - ✅ Pre-flight check en `analysisController.ts:593-607`
  - ✅ Flag retornado en response (línea 956)

## 7. MEDIO: Auditoría Enriquecida

- [x] **7.1** Agregar análisis de negociación
  - ✅ `detectNegotiationPoints()` en `quoteBasedAuditor.ts:330-380`
  - ✅ Detecta deducibles altos, precios por encima del promedio, coberturas faltantes
  - ✅ UI con badges de prioridad y potencial de ahorro

- [x] **7.2** Agregar ventajas competitivas
  - ✅ `detectCompetitiveAdvantages()` en `quoteBasedAuditor.ts:382-470`
  - ✅ Detecta: mejor precio, más coberturas, mejores deducibles, coberturas exclusivas

- [x] **7.3** Agregar recomendaciones por perfil
  - ✅ `detectProfileRecommendations()` en `quoteBasedAuditor.ts:497-608`
  - ✅ Perfiles implementados: Restaurante, Comercio/Retail, Manufactura, Oficina/Servicios
  - ✅ Detección automática por keywords en rawText y policyName
  - ✅ Priorización de coberturas críticas por perfil con riskLevel
  - ✅ UI lista para mostrar (tipo `ProfileRecommendation[]`)

## 8. BAJO: Optimizaciones y Feature Flags

- [x] **8.1** Agregar feature flags
  - ✅ `VITE_ENABLE_V2_2_FIXES` agregado a `config/features.ts:71`
  - ✅ Helper `isV22FixesEnabled()` disponible (línea 95)

- [x] **8.2** Agregar logging de RAG performance
  - ✅ `RagPerformanceLog` interface y `logRagPerformance()` en `ragRetrievalService.ts:23-35`
  - ✅ Instrumentado en `search()`, `vectorSearch()`, `getByCoverage()`

## Dependencias Críticas

```
1.1-1.3 (Fix RPC insurer filter) → 1.5 (Test RAG) → 2.1-2.3 (Scoring fixes)
                                              ↓
                                        6.1-6.3 (RAG improvements)

3.1-3.3 (Anti-alucinaciones) → 5.1-5.4 (Frontend fixes)

4.2 (Sublimit extraction) → 4.1 (DeductibleMatrix) → 7.1-7.3 (Auditoría)
```

## Notas de Implementación

**Problema raíz CONFIRMADO:**
```sql
-- Documentos guardados:
SELECT document_name FROM documents WHERE insurer_id = 'SBS';
-- Resultado: "Clausulado SBS PYME"

-- Pero la cotización extrae:
-- "SBS SEGUROS COLOMBIA S.A."

-- El filtro RPC hace:
-- d.document_name ILIKE '%SBS SEGUROS COLOMBIA S.A.%'
-- "Clausulado SBS PYME" NO coincide con '%SBS SEGUROS COLOMBIA S.A.%'
```

**Solución:** Cambiar filtro de `document_name` a `insurers.name`:
```sql
-- JOIN con insurers y filtrar por i.name
i.name ILIKE '%SBS SEGUROS COLOMBIA S.A.%'
-- o
i.name ILIKE '%SBS%'
```

**Datos de chunks confirmados:**
- 625 chunks en tabla `chunks`
- 9 documentos con chunks
- Fechas: 2026-05-05 a 2026-05-10
- Los chunks EXISTEN, el problema es el filtro de búsqueda

**Tiempos estimados ajustados:**
- Fase 1 (Fix RPC + Test): 1 día
- Fase 2 (Scoring): 1 día
- Fase 3 (Anti-alucinaciones): 2-3 días
- Fase 4 (DeductibleMatrix): 3-4 días
- Fase 5 (Frontend): 1-2 días
- Fase 6-7 (RAG + Audit): 2-3 días
- Testing: 1-2 días
- **Total: 11-16 días**
