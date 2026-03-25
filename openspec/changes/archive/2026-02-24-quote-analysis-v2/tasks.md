# Tasks: Quote Analysis v2

## 1. Backend - Controller Modificado

- [x] 1.1 Añadir parámetro `clauseIds` a endpoint `/api/analyze`
- [x] 1.2 Implementar lógica: si `clauseIds`, fetch de biblioteca
- [x] 1.3 Construir texto de secciones combinadas para prompt
- [x] 1.4 Mantener fallback a flujo actual si no hay `clauseIds`

## 2. Backend - Gemini Service

- [x] 2.1 Crear función `buildSectionText(clauses)` para formatear secciones
- [x] 2.2 Ajustar prompt para indicar que son secciones extraídas
- [x] 2.3 Añadir logs de tokens para comparación

## 3. Frontend - Selector de Clausulados

- [x] 3.1 Crear componente `ClauseSelector.tsx`
- [x] 3.2 Implementar toggle: "Biblioteca" vs "Subir archivos"
- [x] 3.3 Lista de clausulados con checkboxes
- [x] 3.4 Filtro por aseguradora

## 4. Frontend - Integración

- [x] 4.1 Modificar `QuoteUploader.tsx` para incluir ClauseSelector
- [x] 4.2 Actualizar llamada al API con `clauseIds`
- [x] 4.3 Mantener drop zone para upload manual

## 5. Verificación

- [x] 5.1 Probar análisis con clausulados de biblioteca
- [x] 5.2 Comparar tokens: biblioteca vs upload directo
- [x] 5.3 Verificar que resultados son equivalentes
- [x] 5.4 Probar flujo híbrido (upload + biblioteca)

**Notas de Verificación:**
- Script de prueba creado: `server/src/scripts/test_library_analysis.ts`
- El script verifica automáticamente los 4 escenarios de prueba
- Requiere que haya clausulados en la biblioteca (usar ClauseAdmin para subir)
- Ejecutar: `cd server && npx ts-node src/scripts/test_library_analysis.ts`
