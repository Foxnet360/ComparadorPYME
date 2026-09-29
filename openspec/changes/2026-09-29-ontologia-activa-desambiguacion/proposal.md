# Proposal: Ontología Activa con Tri-Banda de Confianza y Micro-Intervenciones UI

## Intent
Implementar la Fase 2 del Plan Integral de Modernización del comparador:
1. **Tri-Banda de Confianza en Ontología (`coverageOntology.ts`)**: Reemplazar la clasificación binaria (éxito vs. fallo) por tres bandas semánticas explícitas:
   - **Banda Verde (`trusted` $\ge 85\%$):** Asignación canónica automática transparente.
   - **Banda Amarilla (`ambiguous` $50\% - 84\%$):** Pre-asignación con requerimiento de validación activa.
   - **Banda Roja (`autonomous` $< 50\%$):** Preservación de la cobertura como amparo autónomo/exclusivo para no forzar agrupaciones artificiales.
2. **Micro-intervenciones de Desambiguación en UI (`DisambiguationCard.tsx`):**
   - Presentar al corredor las 2 o 3 coberturas que caen en zona de ambigüedad con acciones de un solo clic (`[Confirmar]`, `[Mantener Autónomo]`).
3. **Bucle de Aprendizaje Activo en Caliente:**
   - Endpoint `POST /api/analysis/disambiguate-coverage` que invoca `learningEngine.saveCorrection` para registrar la decisión en `coverage_mappings` de Supabase, enriquecer los embeddings y evitar que el sistema vuelva a dudar con esa aseguradora en el futuro.

## Scope
1. **Modelos y Métodos de Ontología (`server/src/services/coverageOntology.ts`):**
   - Incorporar tipo `OntologyCertaintyBand` y función `resolveCertaintyBand`.
   - Etiquetar cada mapeo con su banda de certeza y flag `needsHumanReview`.
2. **Endpoint de Desambiguación (`server/src/controllers/analysisValidationController.ts` y `server/src/routes/analysis.ts`):**
   - `POST /api/analysis/disambiguate-coverage` con soporte para confirmar mapeo o declarar amparo autónomo.
3. **Feature Flags (`server/src/config/featureFlags.ts`):**
   - `enableActiveOntologyDisambiguation`: activa la tri-banda y el componente visual.
4. **Componente Visual (`components/report/DisambiguationCard.tsx`):**
   - Renderizado en `components/AuditSection.tsx` con límite estricto de máximo 3 sugerencias para prevenir fatiga cognitiva.

## Rollback Plan
- Desactivar la variable de entorno `ENABLE_ACTIVE_ONTOLOGY_DISAMBIGUATION=false`.
- El mapeo ontológico tradicional sigue operando sin interrupción.

## Impact
- Eliminación de errores silenciosos por asignaciones forzadas.
- Alimentación continua del motor de aprendizaje sin fricción para el usuario.
- Cero regresión en reportes existentes.
