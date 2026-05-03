## 1. Setup y Configuración

- [x] 1.1 Crear servicio `semanticMatcher.ts` con estructura base y tipos
- [x] 1.2 Definir constantes: 14 categorías canónicas, umbrales de confianza, lista de sinónimos
- [x] 1.3 Implementar cache de embeddings para nombres de cobertura
- [x] 1.4 Actualizar tipos TypeScript (`ParsedCoverage`, `CoverageItem`) con campos de mapeo

## 2. Capa 1: Matching por Thesaurus Exacto

- [x] 2.1 Implementar función `matchByThesaurus()` que busca coincidencia exacta en sinónimos
- [x] 2.2 Normalizar texto (lowercase, sin acentos) antes de matching
- [x] 2.3 Retornar `{ categoryId, canonicalName, confidence: 1.0, method: 'thesaurus' }`
- [x] 2.4 Test con ejemplos de `/Ejemplos`: verificar que nombres exactos mapean correctamente

## 3. Capa 2: Matching por Fuzzy Similarity

- [x] 3.1 Implementar función `matchByFuzzy()` usando Levenshtein distance
- [x] 3.2 Calcular confianza como `1 - (distancia / longitud máxima)`
- [x] 3.3 Umbral: solo retornar match si confianza >= 0.6
- [x] 3.4 Test con variantes tipográficas (ej: "Responsaviliad" → "Responsabilidad")

## 4. Capa 3: Matching por Embedding Similarity

- [x] 4.1 Implementar función `matchByEmbedding()` usando `embeddingService`
- [x] 4.2 Generar embeddings para las 14 categorías canónicas (precalcular)
- [x] 4.3 Comparar embedding de cobertura vs embeddings de categorías (cosine similarity)
- [x] 4.4 Umbral: solo retornar match si cosine similarity > 0.7
- [x] 4.5 Implementar cache para evitar regenerar embeddings de coberturas repetidas
- [x] 4.6 Test con coberturas que no mapean por thesaurus/fuzzy pero son semánticamente similares

## 5. Capa 4: LLM Fallback

- [x] 5.1 Crear prompt específico para clasificación de coberturas
- [x] 5.2 Implementar función `matchByLLM()` que consulta Gemini
- [x] 5.3 Parsear respuesta de Gemini para extraer categoryId y confianza
- [x] 5.4 Timeout de 2 segundos por cobertura
- [x] 5.5 Solo ejecutar si capas 1-3 no logran confianza >= 0.6
- [x] 5.6 Test con coberturas ambiguas que requieren interpretación semántica

## 6. Integración Backend

- [x] 6.1 Modificar `quoteParser.ts` para llamar `semanticMatcher` después de extraer coberturas
- [x] 6.2 Actualizar `analysisController.ts` para incluir campos nuevos en output JSON
- [x] 6.3 Asegurar compatibilidad hacia atrás (campos adicionales, no breaking)
- [x] 6.4 Agregar logging de matches para auditoría
- [x] 6.5 Test end-to-end: PDF → extracción → matching → API response

## 7. Frontend - Matriz Unificada

- [x] 7.1 Refactorizar `ComparisonReport.tsx` (tab Coberturas) para usar 14 filas fijas
- [x] 7.2 Crear componente `UnifiedCoverageMatrix` con renderizado por categoría
- [x] 7.3 Implementar agrupación de coberturas por `canonicalName`/`categoryId`
- [x] 7.4 Mostrar "No incluida" para categorías faltantes en una cotización
- [x] 7.5 Crear sección "Coberturas No Categorizadas" para matches con confianza < 0.6

## 8. Frontend - Indicadores Visuales

- [x] 8.1 Crear componente `ConfidenceBadge` con 3 niveles (verde/amarillo/rojo)
- [x] 8.2 Implementar tooltip con nombre original, canónico, y método de match
- [x] 8.3 Manejar visualización de múltiples coberturas en misma categoría
- [x] 8.4 Actualizar `DeductiblesComparisonTable.tsx` para usar categorías canónicas

## 9. Testing y Validación

- [x] 9.1 Test unitarios para `semanticMatcher.ts` (4 capas) - 24/24 tests pasando
- [x] 9.2 Test con ejemplos en `/Ejemplos`: validar precision/recall del matching
- [x] 9.3 Test de integración: flujo completo de 4 cotizaciones
- [x] 9.4 Verificar performance: matching de 15 coberturas en 15ms (1.0ms/cobertura, requisito <5s cumplido)
- [x] 9.5 Validar compatibilidad frontend legacy (ignora campos nuevos)
- [x] 9.6 Fix bug: "ROTURA DE VIDRIOS" mapeaba a cat 5 (Rotura de Maquinaria) en vez de cat 7 (Vidrios Planos)
- [x] 9.7 Test con API Key real: capas 3-4 (embeddings/LLM) funcionando - 19/20 casos reales correctos (95%)

## 10. Documentación y Deploy

- [x] 10.1 Actualizar README con descripción del sistema de matching
- [x] 10.2 Documentar contrato de API (nuevos campos en coverage)
- [ ] 10.3 Deploy backend primero (compatible con frontend existente)
- [ ] 10.4 Deploy frontend actualizado
- [x] 10.5 Validación final con datos reales de cotizaciones (20 casos de uso real, 95% precisión)
