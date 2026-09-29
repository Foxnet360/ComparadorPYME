# Tasks: Ontología Activa con Tri-Banda de Confianza y Micro-Intervenciones UI

## Phase 1: Feature Flag y Modelos Ontológicos
- [x] 1.1 Registrar la bandera `enableActiveOntologyDisambiguation` en `server/src/config/featureFlags.ts`.
- [x] 1.2 Incorporar `OntologyCertaintyBand` y función helper `resolveCertaintyBand` en `server/src/services/coverageOntology.ts`.
- [x] 1.3 Actualizar `CoverageMapping` para incluir `certaintyBand`.

## Phase 2: Lógica de Tri-Banda y Tests Unitarios
- [x] 2.1 Refactorizar `mapCoverage` en `server/src/services/coverageOntology.ts` para asignar la banda de certeza de forma consistente.
- [x] 2.2 Crear suite de tests `server/src/services/__tests__/coverageOntologyTriBand.test.ts`.

## Phase 3: Endpoint de Desambiguación
- [x] 3.1 Implementar `disambiguateCoverage` en `server/src/controllers/analysisValidationController.ts`.
- [x] 3.2 Exponer la ruta `POST /disambiguate-coverage` en `server/src/routes/analysis.ts`.
- [x] 3.3 Crear test de endpoint en `server/src/controllers/__tests__/disambiguationController.test.ts`.

## Phase 4: Componente Frontend de Desambiguación
- [x] 4.1 Crear `components/report/DisambiguationCard.tsx` con acciones de 1 clic y límite de 3 tarjetas.
- [x] 4.2 Integrar `DisambiguationCard` en `components/AuditSection.tsx`.
- [x] 4.3 Crear pruebas de renderizado e interacción para `DisambiguationCard.test.tsx`.

## Phase 5: Verificación y Sincronización Engram
- [x] 5.1 Ejecutar `npm run typecheck:frontend` y `npm run typecheck:backend`.
- [x] 5.2 Ejecutar suites de test completas.
- [x] 5.3 Registrar avance en Engram y cerrar la fase.
