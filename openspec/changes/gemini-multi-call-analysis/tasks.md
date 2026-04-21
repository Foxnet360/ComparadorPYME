## 1. Preparación y Token Counting

- [x] 1.1 Agregar función `countTokens()` en `gemini.ts` para pre-calcular tokens antes de enviar
- [x] 1.2 Implementar lógica de división en lotes si input excede 80% del contexto
- [x] 1.3 Crear tipos TypeScript para los 3 outputs de fase

## 2. Fase 1: Extracción de Datos

- [x] 2.1 Crear `quoteExtractor.ts` con schema simple para extraer datos brutos
- [x] 2.2 Implementar prompt específico para extracción (sin análisis, solo datos)
- [x] 2.3 Validar output: debe contener insurerName, policyName, priceAnnual, coverages[]
- [x] 2.4 Agregar retry con lote de 2 cotizaciones si falla con 3-5

## 3. Fase 2: Scoring y Alerts

- [x] 3.1 Crear `quoteScorer.ts` que recibe output de Fase 1 y calcula scores
- [x] 3.2 Implementar schema para scoringBreakdown + alerts
- [x] 3.3 Validar que scores estén entre 0-100 y sean números enteros
- [x] 3.4 Mergear scoring con datos extraídos de Fase 1

## 4. Fase 3: Narrativa

- [x] 4.1 Crear `quoteNarrative.ts` que recibe Fase 1 + Fase 2
- [x] 4.2 Implementar schema simple: { recommendation, marketAnalysis }
- [x] 4.3 Limitar output a máximo 2000 caracteres por campo
- [x] 4.4 Combinar los 3 outputs en la respuesta final esperada por el frontend

## 5. Integración con Controller

- [x] 5.1 Modificar `analysisController.ts` para usar la pipeline de 3 fases
- [x] 5.2 Agregar logging de progreso por fase ("Fase 1/3: Extrayendo...")
- [x] 5.3 Mantener API existente: endpoint `/api/analyze` sin cambios de contrato
- [x] 5.4 Guardar resultado en Supabase como antes

## 6. Testing y Validación

- [ ] 6.1 Probar con 3 cotizaciones reales (SBS, HDI, MAPFRE)
- [ ] 6.2 Verificar que no haya JSON truncado en ninguna fase
- [ ] 6.3 Medir tiempo total vs approach anterior
- [ ] 6.4 Validar que la respuesta final sea compatible con el frontend actual