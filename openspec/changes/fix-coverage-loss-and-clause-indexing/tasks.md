## 1. Fase 1: Hotfix - Preservar coberturas y reparar auditoría

- [x] 1.1 Modificar `coverageNormalizer.ts` (líneas ~613-618): eliminar filtro `.filter(c => c.insuredAmount !== null || c.premium !== null)` para coberturas uncategorized
- [x] 1.2 Verificar que coberturas sin valor ni prima se preservan con `needsReview: true` y `confidence: 0`
- [x] 1.3 Modificar `auditEnrichmentService.ts` (`checkClausesAvailability`): cambiar query primero a tabla `chunks` con JOIN a `documents`
- [x] 1.4 Agregar fallback a `clause_chunks` solo si `chunks` no tiene datos
- [ ] 1.5 Verificar que el botón "Enriquecer" se habilita cuando `chunks` tiene clausulados
- [ ] 1.6 Test manual: subir cotización y verificar que coberturas no desaparecen

## 2. Fase 2: Estructural - Schema y base de datos

- [x] 2.1 Modificar `gemini.ts` (`QuoteExtractionSchemaV2`): cambiar `deductible` de `nullable: false` a `nullable: true`
- [x] 2.2 Actualizar instrucción del prompt si menciona "NEVER leave empty"
- [x] 2.3 Aplicar migración `013_structured_clauses_and_search.sql` en Supabase (crear tablas y función `search_structured_clauses`)
- [x] 2.4 Verificar que `search_structured_clauses` existe con `SELECT * FROM pg_proc WHERE proname = 'search_structured_clauses'`
- [ ] 2.5 Test manual: extraer cotización con cobertura sin deducible y verificar que no se rechaza

## 3. Fase 3: Polish - Logging y observabilidad

- [x] 3.1 Agregar logging en `coverageNormalizer.ts` cuando una cobertura se descarta (con rawName, razón, insurer, filename)
- [x] 3.2 Modificar `structuredClauseExtractor.ts`: cambiar `console.error` a `console.info` para fallback a legacy RAG
- [x] 3.3 Verificar rendering de `uncategorizedCoverages` en frontend (ComparisonTable, QuoteDetail)
- [x] 3.4 Agregar tooltip o leyenda para coberturas "Sin clasificar" en la UI
- [ ] 3.5 Ejecutar análisis completo con 3 cotizaciones y verificar: HDI muestra 17, SBS muestra 21, Allianz muestra 3
- [ ] 3.6 Verificar que auditoría de riesgos ya no muestra "No hay clausulados indexados" si existen documentos indexados

## 4. Validación y rollback

- [ ] 4.1 Ejecutar tests existentes (`npm test` o similar) — No hay tests configurados
- [ ] 4.2 Revisar logs de producción por 24h para confirmar reducción de errores RAG
- [x] 4.3 Documentar rollback: comandos para revertir cambios en BD y código

---

## Rollback Procedures

### Código (git revert)

Los cambios de código están en estos archivos:
- `server/src/services/coverageNormalizer.ts`
- `server/src/services/auditEnrichmentService.ts`
- `server/src/services/gemini.ts`
- `server/src/services/structuredClauseExtractor.ts`

**Para revertir:**
```bash
git checkout -- server/src/services/coverageNormalizer.ts
git checkout -- server/src/services/auditEnrichmentService.ts
git checkout -- server/src/services/gemini.ts
git checkout -- server/src/services/structuredClauseExtractor.ts
```

### Base de datos

**Revertir migración 015 (structured_clauses):**
```sql
DROP TABLE IF EXISTS coverage_mappings CASCADE;
DROP TABLE IF EXISTS deductible_benchmarks CASCADE;
DROP TABLE IF EXISTS structured_clauses CASCADE;
DROP FUNCTION IF EXISTS search_structured_clauses(TEXT, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS get_clause_deductible(TEXT, TEXT);
```

**Nota:** Las funciones `update_updated_at_column()` y `expand_search_query()` pueden ser usadas por otras partes del sistema. Verificar dependencias antes de dropearlas.

### Verificación post-rollback

1. Extraer cotización de prueba
2. Verificar que coberturas SIN valor ni prima se descartan (comportamiento anterior)
3. Verificar que auditoría muestra "No hay clausulados indexados" si no hay chunks
4. Verificar que `search_structured_clauses` ya no existe: `SELECT * FROM pg_proc WHERE proname = 'search_structured_clauses'` debe retornar vacío
