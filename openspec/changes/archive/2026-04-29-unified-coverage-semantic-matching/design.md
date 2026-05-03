## Context

El sistema Comparador CSA extrae datos de cotizaciones de seguros PYME y las presenta en una matriz de comparación. Actualmente, cada cobertura se muestra en una fila separada basada en su nombre extraído del PDF. Cuando dos aseguradoras usan nombres diferentes para la misma cobertura (ej: "Responsabilidad Civil" vs "RC Daños a Terceros" vs "RCE"), aparecen como filas distintas en la matriz, dificultando la comparación.

El backend ya tiene:
- `thesaurusService.ts` con las 14 categorías canónicas y sus sinónimos
- `thesaurusMapper.ts` con fuzzy matching (Levenshtein)
- Servicio de embeddings (`embeddingService.ts`)
- Integración con Gemini para extracción

El frontend tiene:
- `ComparisonReport.tsx` con 4 tabs (Resumen, Coberturas, Deducibles, Auditoría)
- `PLANTILLA_ITEMS` con las 14 categorías en `constants.ts`
- Lógica de agrupación basada en `normalizeText()` que NO unifica semanticamente

## Goals / Non-Goals

**Goals:**
- Unificar coberturas semanticamente equivalentes bajo 14 categorías canónicas
- Proporcionar confianza del match para cada cobertura
- Mostrar matriz de comparación con exactamente 14 filas + coberturas no categorizadas
- Mantener transparencia: mostrar nombre original como tooltip/reference

**Non-Goals:**
- No modificar el proceso de extracción de texto de PDFs
- No cambiar el modelo de datos de Supabase
- No implementar re-entrenamiento automático del thesaurus
- No soportar más de 14 categorías canónicas (scope fijo)

## Decisions

### Decision 1: Mapeo en backend, no en frontend
**Opción A (elegida)**: El backend enriquece cada `ParsedCoverage` con `canonicalName`, `categoryId`, `matchConfidence`, `matchMethod`.
**Opción B**: Frontend hace el mapeo.
**Rationale**: Single source of truth. El backend tiene acceso al thesaurus y embeddings. Evita duplicar lógica. Permite auditar matches en logs.

### Decision 2: Sistema de 4 capas en cascada
**Capa 1**: Thesaurus exacto (sinónimos predefinidos) → confianza 1.0
**Capa 2**: Fuzzy matching (Levenshtein distance) → confianza basada en distancia
**Capa 3**: Embedding similarity (cosine similarity) → confianza basada en similitud
**Capa 4**: LLM fallback (solo si confianza < 0.7 en capas anteriores) → confianza basada en respuesta
**Rationale**: Eficiencia progresiva. Las capas rápidas (1-2) resuelven 80% de casos. Las capas costosas (3-4) solo para casos difíciles.

### Decision 3: Umbral de confianza = 0.6 para categorización
- ≥0.6: Se asigna a categoría canónica
- <0.6: Va a "Coberturas No Categorizadas"
**Rationale**: Balance entre precisión y recall. Demasiado alto (0.8) dejaría muchas coberturas sin categorizar. Demasiado bajo (0.4) causaría falsos positivos.

### Decision 4: Frontend usa filas fijas de 14 categorías
En lugar de mostrar solo coberturas presentes, el frontend renderiza siempre las 14 filas. Las coberturas faltantes se marcan como "No incluida".
**Rationale**: Facilita la comparación visual. El usuario ve inmediatamente qué coberturas le falta a cada cotización.

## Risks / Trade-offs

- **[Riesgo] Falsos positivos en matching**: Una cobertura mal categorizada puede confundir al usuario.
  → **Mitigación**: Mostrar confianza del match visualmente. Permitir override manual en futuras versiones.
  
- **[Riesgo] Múltiples coberturas en misma categoría**: Una cotización podría tener 2 coberturas que mapean a la misma categoría (ej: "Incendio Edificio" + "Incendio Contenidos").
  → **Mitigación**: Mostrar ambas en la misma celda con separador. Agregar indicador visual de "múltiples coberturas".

- **[Riesgo] Degradación de performance**: Capa 3 (embeddings) y 4 (LLM) son costosas.
  → **Mitigación**: Cache de embeddings para nombres de cobertura. LLM solo como último recurso. Timeout de 2s por cobertura.

- **[Riesgo] Cambio breaking en API**: Frontend existente podría romperse.
  → **Mitigación**: Los nuevos campos son adicionales, no reemplazan existentes. Frontend legacy puede ignorarlos.

## Migration Plan

1. Implementar `semanticMatcher.ts` con las 4 capas
2. Modificar `quoteParser.ts` para llamar al matcher
3. Actualizar `analysisController.ts` para incluir campos nuevos en output
4. Actualizar `ComparisonReport.tsx` para usar `canonicalName` para agrupación
5. Agregar sección "Coberturas No Categorizadas"
6. Testing con ejemplos en `/Ejemplos`
7. Deploy backend primero (compatible con frontend legacy)
8. Deploy frontend

## Open Questions

- ¿El LLM fallback debería usar Gemini (más lento) o un prompt simple?
- ¿Necesitamos un mecanismo de feedback para mejorar el thesaurus (thumbs up/down)?
- ¿Cómo manejamos coberturas "no estándar" que no encajan en ninguna de las 14 categorías?
