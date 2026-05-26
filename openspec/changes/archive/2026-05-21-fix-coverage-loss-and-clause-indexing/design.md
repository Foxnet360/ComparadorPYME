## Context

El sistema de análisis de cotizaciones tiene dos problemas críticos en producción:

1. **Pérdida de coberturas**: El pipeline de extracción-normalización procesa PDFs de cotizaciones y extrae coberturas con Gemini 2.5 Pro (entre 3 y 21 coberturas por PDF). Sin embargo, el `coverageNormalizer.ts` filtra agresivamente las coberturas que no mapean a las 14 categorías canónicas PYME y no tienen `insuredAmount` ni `premium`. Esto causa que coberturas textuales válidas (ej: "Gastos de Defensa", "Asistencia Jurídica") desaparezcan silenciosamente. Los logs muestran: HDI 17→9, SBS 21→8 coberturas perdidas.

2. **RAG de clausulados inoperante**: La sección "Auditoría de Riesgos" muestra siempre "No hay clausulados indexados disponibles". La causa es un desfase arquitectónico: el `documentIndexingService` escribe chunks en la tabla `chunks` (embedding 3072, sin `insurer_name` directo), pero `auditEnrichmentService.checkClausesAvailability()` consulta primero `clause_chunks` (embedding 768, con `insurer_name`) que nunca se pobla. Además, la función RPC `search_structured_clauses` (migración 013) no existe en la base de datos.

## Goals / Non-Goals

**Goals:**
- Preservar TODAS las coberturas extraídas del PDF, mostrándolas al usuario como "Sin clasificar" si no mapean a categorías canónicas
- Reparar la detección de clausulados disponibles para que la auditoría de riesgos funcione
- Hacer que el schema de extracción acepte deducibles nulos sin rechazar coberturas válidas
- Reducir el noise de errores en logs (errores de RAG que en realidad son fallbacks graceful)

**Non-Goals:**
- Rediseñar la UI de comparación (solo asegurar que uncategorized se rendericen)
- Reentrenar el modelo de embeddings o cambiar la dimensión (3072)
- Implementar un nuevo sistema de indexado de clausulados (solo reparar el existente)
- Modificar el comportamiento de las 14 categorías canónicas

## Decisions

### 1. Relajar filtro de uncategorized en coverageNormalizer.ts
**Decision**: Eliminar la condición `.filter(c => c.insuredAmount !== null || c.premium !== null)` para coberturas no mapeadas.

**Rationale**: Una cobertura con nombre válido extraído del PDF es información contractual real. Filtrarla por no tener valor numérico asume que todas las coberturas incluyen suma asegurada explícita, lo cual no es cierto en cotizaciones donde los valores están en tablas generales o se heredan de amparos básicos.

**Alternativas consideradas**:
- (a) Bajar el umbral de filtrado (ej: solo descartar si name está vacío) → Seleccionado: más simple y correcto
- (b) Agregar un flag de configuración para activar/desactivar el filtro → Rechazado: complejidad innecesaria, el comportamiento correcto es preservar siempre
- (c) Intentar derivar el valor desde assets antes de descartar → Parcialmente ya se hace, pero no cubre todos los casos

### 2. Consultar tabla `chunks` primero en checkClausesAvailability
**Decision**: Cambiar `auditEnrichmentService.ts` para que query primero la tabla `chunks` (join con `documents`) antes de `clause_chunks`.

**Rationale**: La tabla `chunks` es la única que tiene datos reales porque es donde el `documentIndexingService` escribe. La tabla `clause_chunks` fue diseñada pero nunca integrada al pipeline de indexado.

**Alternativas consideradas**:
- (a) Migrar datos de `chunks` → `clause_chunks` → Rechazado: requiere recrear embeddings con dimensión 768, trabajo mayor
- (b) Modificar el indexador para escribir en ambas tablas → Rechazado: duplicaría datos y complejidad
- (c) Unificar las tablas en una sola → Rechazado: breaking change de schema mayor, fuera del scope

### 3. Hacer deductible nullable en QuoteExtractionSchemaV2
**Decision**: Cambiar `deductible: { type: SchemaType.STRING, nullable: false }` a `nullable: true`.

**Rationale**: Muchas cotizaciones especifican deducibles en una tabla general al inicio del documento, no por cada cobertura. Forzar un string no-nulo obliga a Gemini a inventar valores o causa rechazo de coberturas válidas.

**Alternativas consideradas**:
- (a) Cambiar a `nullable: true` pero con default "No especificado" → Rechazado: confunde "no hay deducible" con "no se especificó"
- (b) Usar un enum de deducibles conocidos → Rechazado: muy rígido, los deducibles varían mucho
- (c) Mantener no-nullable y post-procesar → Rechazado: el problema ocurre en la validación del schema, antes del post-proceso

### 4. Reducir severidad de logs en structuredClauseExtractor fallback
**Decision**: Cambiar logs de `console.error` a `console.info` cuando el fallback a legacy RAG ocurre.

**Rationale**: El fallback es comportamiento esperado y graceful, no un error. Los logs de error actuales generan noise y ocultan errores reales.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Mostrar coberturas "basura" del PDF (errores de OCR o extracción) | Marcar todas las uncategorized con `needsReview: true` y `confidence: 0`. La UI ya tiene patrones para resaltar items que necesitan revisión. |
| La tabla `chunks` no tiene `insurer_name` directo, requiere JOIN | El JOIN con `documents` es eficiente (índice en `document_type`). Si hay performance issues, se puede agregar un índice compuesto. |
| Cambiar nullable en schema puede afectar código downstream que asume string | Auditar todos los usos de `coverage.deductible` para manejar null. El normalizador ya tiene lógica de "No especificado" para casos sin deductible. |
| Usuarios confundidos por coberturas "Sin clasificar" | Incluir tooltip o leyenda en la UI explicando que estas coberturas provienen directamente del PDF y no encajan en las categorías estándar. |
| Migración 013 no se puede aplicar fácilmente en producción | Documentar el paso como parte del deployment. La aplicación ya tiene graceful fallback si la función no existe. |

## Migration Plan

### Paso 1: Hotfix (aplicable inmediatamente)
1. Modificar `coverageNormalizer.ts`: eliminar filtro por valor en uncategorized
2. Modificar `auditEnrichmentService.ts`: query `chunks` primero
3. Desplegar

### Paso 2: Estructural
4. Aplicar migración `013_structured_clauses_and_search.sql` en Supabase
5. Modificar `gemini.ts`: `deductible` nullable en schema V2
6. Desplegar

### Paso 3: Polish
7. Agregar logging de coberturas descartadas
8. Reducir severidad de logs en fallback
9. Verificar rendering de uncategorized en frontend

### Rollback
- Hotfix: revertir los 2 archivos modificados
- Estructural: la migración 013 es idempotente (CREATE OR REPLACE). Para rollback, dropear las nuevas tablas/functions.

## Open Questions

1. **¿Cuántas coberturas "basura" realmente aparecerán al eliminar el filtro?** → Requiere validación con datos reales. Si el número es muy alto, podríamos necesitar un filtro más inteligente (ej: descartar solo si rawName está vacío o tiene < 3 caracteres).

2. **¿Existe un índice adecuado en `chunks.document_id`?** → Verificar performance del JOIN con `documents` en producción.

3. **¿La UI actual ya tiene un slot para renderizar `uncategorizedCoverages`?** → Revisar `components/ComparisonTable.tsx` o similar para confirmar que el campo ya se consume o si hay que modificar el componente.
