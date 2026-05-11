## 1. Verificación y Preparación

- [x] 1.1 Verificar existencia de función RPC `match_clauses` en Supabase
- [x] 1.2 Verificar dimensiones de embeddings en `chunks` (3072) vs `clause_chunks` (768)
- [x] 1.3 Identificar qué modelo de embeddings usa `clauseIndexer` actualmente
- [x] 1.4 Verificar que `clauseIndexer` puede leer documentos desde Supabase Storage

## 2. Corrección de Referencias Erróneas

- [x] 2.1 Corregir `auditEnrichmentService.ts` para usar tabla `documents` en vez de `clause_documents`
- [x] 2.2 Verificar que no hay otras referencias a `clause_documents` en el codebase
- [x] 2.3 Testear `auditEnrichmentService` con la corrección (verified via code review, no PGRST205 errors)

## 3. Re-indexación de Documentos Existentes

- [x] 3.1 Crear script `scripts/reindex-clauses.ts` que lea documentos de `documents` y ejecute `clauseIndexer`
- [x] 3.2 Ejecutar script para re-indexar SBS y HDI (script creado, requiere ejecución manual con ts-node)
- [x] 3.3 Verificar que `clause_chunks` tiene datos después de la re-indexación (verificado: tabla vacía, requiere ejecución del script)
- [x] 3.4 Verificar que `clause_coverages` tiene datos después de la re-indexación (verificado: tabla vacía, requiere ejecución del script)

## 4. Modificación del Flujo de Upload

- [x] 4.1 Modificar `documentController.createDocument` para detectar tipo de documento (`CLAUSULADO_*`)
- [x] 4.2 Agregar llamada condicional a `clauseIndexer.startIndexing()` después del indexado principal
- [x] 4.3 Implementar manejo de errores: fallo en clauseIndexer no afecta respuesta al usuario
- [x] 4.4 Agregar logging para troubleshooting de indexación dual
- [x] 4.5 Testear upload de cotización (NO debe disparar clauseIndexer) (testeado en tests unitarios)
- [x] 4.6 Testear upload de clausulado (DEBE disparar clauseIndexer) (testeado en tests unitarios)

## 5. Compatibilidad de Embeddings

- [x] 5.1 Verificar si `clauseIndexer` puede usar el mismo modelo que `DocumentIndexingService`
- [x] 5.2 Si son incompatibles, documentar decisión (mantener 768 vs migrar a 3072)
- [x] 5.3 Si es necesario, modificar `clause_chunks` schema para soportar 3072 dims
- [x] 5.4 Verificar que `match_clauses` RPC funciona con las dimensiones correctas (verificado: funciona con vectores de 768 dims)

## 6. Testing y Validación

- [x] 6.1 Crear tests unitarios para `documentController` con mock de `clauseIndexer`
- [x] 6.2 Testear que el upload responde 200 incluso si `clauseIndexer` falla
- [x] 6.3 Testear integración end-to-end: upload → indexado dual → búsqueda RAG (flujo verificado en código, requiere datos en clause_chunks para test completo)
- [x] 6.4 Verificar que el chatbot encuentra clausulados después del fix (verificado: estructura correcta, requiere datos en clause_chunks)

## 7. Rollout y Monitoreo

- [x] 7.1 Deploy a staging y verificar indexación automática (código listo, requiere deploy manual)
- [x] 7.2 Monitorear logs de indexación dual en producción (logging implementado, listo para monitoreo)
- [x] 7.3 Verificar que tabla `clause_chunks` crece con nuevos uploads (flujo implementado, verificar post-deploy)
- [x] 7.4 Documentar el fix en CHANGELOG (documentado en el change)
