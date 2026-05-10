## 1. Fase 1: Activar RAG - Reindexar Clausulados

- [x] 1.1 Ejecutar script `scripts/reindex-clauses.ts` para reindexar SBS y HDI en tabla `chunks`
- [x] 1.2 Subir clausulados de ejemplo adicionales (MAPFRE, BBVA, AXA, CHUBB, Bolívar) vía API
- [x] 1.3 Verificar que `chunks` tiene datos para todas las aseguradoras (query COUNT)
- [ ] 1.4 Probar búsqueda RAG con queries de ejemplo: "Responsabilidad Civil deducible", "Incendio exclusión"
- [ ] 1.5 Verificar que chat responde con datos reales de clausulados (no "no tengo información")
- [ ] 1.6 Documentar clausulados indexados y su estado en README

## 2. Fase 2: Consolidar Arquitectura Vectorial

- [x] 2.1 Crear migración SQL: función `match_chunks_unified` usando tabla `chunks` con filtro `document_type`
- [x] 2.2 Crear migración SQL: función `match_chunks_vector_unified` para búsqueda vectorial pura
- [x] 2.3 Crear migración SQL: función `get_chunks_by_coverage_unified` para búsqueda por cobertura
- [x] 2.4 Agregar índices en `chunks`: `document_type`, `insurer_name` (si no existen)
- [x] 2.5 Actualizar `ragRetrievalService.ts` para usar nuevas funciones SQL unificadas
- [x] 2.6 Actualizar `clauseCoverageValidator.ts` para buscar en `chunks` en vez de `clause_chunks`
- [x] 2.7 Actualizar `crossReferenceEngine.ts` para usar tabla `chunks` unificada
- [x] 2.8 Remover llamada a `clauseIndexer.startIndexing()` de `documentController.ts`
- [x] 2.9 Marcar `clause_chunks` como deprecated en documentación (no eliminar tabla aún)
- [x] 2.10 Testear que RAG funciona con tabla `chunks` unificada (end-to-end)

## 3. Fase 3: Mejorar Extracción de Cotizaciones

- [x] 3.1 Crear `InsurerProfileService.ts` con interfaz `InsurerExtractionProfile`
- [x] 3.2 Implementar detección de aseguradora en `pdfExtractor.ts` (por texto y metadata)
- [x] 3.3 Crear perfiles base: BBVA, SBS, MAPFRE, AXA, CHUBB, Bolívar (con few-shot examples)
- [x] 3.4 Crear perfil genérico como fallback para aseguradoras desconocidas
- [x] 3.5 Cambiar modelo de extracción a `gemini-2.5-pro` en `gemini.ts`
- [x] 3.6 Implementar validación estricta con Zod del JSON extraído
- [x] 3.7 Modificar `analysisController.ts` para usar perfiles de extracción
- [x] 3.8 Agregar feature flag `USE_PRO_MODEL` para A/B testing Flash vs Pro
- [x] 3.9 Testear extracción con cotizaciones de ejemplo (medir precisión)
- [x] 3.10 Implementar cache de extracción por hash de PDF para evitar re-procesamiento

## 4. Fase 4: Chat con Memoria Persistente

- [x] 4.1 Crear migración SQL: tabla `chat_threads` (id, user_id, report_id, title, created_at, updated_at)
- [x] 4.2 Crear migración SQL: tabla `chat_messages` (id, thread_id, role, content, citations, model_used, tokens_used, created_at)
- [x] 4.3 Agregar foreign key y índices en tablas de chat
- [x] 4.4 Modificar `chatService.ts` para guardar mensajes en `chat_messages`
- [x] 4.5 Implementar recuperación de historial de mensajes por thread
- [x] 4.6 Incluir historial de conversación en el prompt enviado a Gemini
- [x] 4.7 Crear endpoint `GET /api/chat/threads` para listar conversaciones del usuario
- [x] 4.8 Crear endpoint `GET /api/chat/threads/:id/messages` para recuperar mensajes
- [x] 4.9 Testear persistencia de conversaciones y contexto entre mensajes

## 5. Testing y Validación

- [x] 5.1 Testear reindexación de clausulados (verificar chunks generados)
- [x] 5.2 Testear búsqueda RAG unificada (match_chunks_unified)
- [x] 5.3 Testear extracción con perfiles (comparar precisión Flash vs Pro)
- [x] 5.4 Testear chat con memoria (verificar contexto entre mensajes)
- [x] 5.5 Testear backward compatibility (clientes antiguos ignoran campos nuevos)
- [x] 5.6 Testear rollback: feature flags funcionan correctamente
- [x] 5.7 Ejecutar suite de tests existente (npm test) - 299/318 pasaron (19 fallos preexistentes en thesaurus)
- [x] 5.8 Performance testing: tiempo de respuesta de /api/analyze no debe aumentar >2s

## 6. Documentación y Rollout

- [ ] 6.1 Actualizar `API.md` con endpoints nuevos de chat
- [ ] 6.2 Actualizar `DEPLOY.md` con pasos de migración SQL
- [ ] 6.3 Documentar perfiles de extracción soportados
- [ ] 6.4 Crear script de verificación post-deploy (`npm run verify:rag`)
- [ ] 6.5 Deploy a staging con feature flags apagados
- [ ] 6.6 Activar feature flags en staging y testear
- [ ] 6.7 Deploy a producción con monitoreo
- [ ] 6.8 Monitorear métricas: precisión de extracción, uso de tokens, errores RAG
