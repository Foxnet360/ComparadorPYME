# Tasks: Extracción Estructurada Multimodal en Dos Fases con Respaldo Automático

## Phase 1: Feature Flag y Modelos de Dos Fases
- [x] 1.1 Registrar la bandera `enableTwoStageExtraction` en `server/src/config/featureFlags.ts`.
- [x] 1.2 Definir los tipos de datos de Fase 1 y Fase 2 en `server/src/types/twoStageExtraction.ts`.

## Phase 2: Extractores de Fase 1 y Fase 2
- [x] 2.1 Implementar `server/src/services/twoStageExtraction/globalStructureExtractor.ts`.
- [x] 2.2 Implementar `server/src/services/twoStageExtraction/focalizedCoverageExtractor.ts`.
- [x] 2.3 Crear tests unitarios para los extractores individuales.

## Phase 3: Orquestador y Fallback a Pipeline V2
- [x] 3.1 Implementar `server/src/services/twoStageExtraction/twoStageExtractionOrchestrator.ts` con manejo de fallback.
- [x] 3.2 Crear tests unitarios para el orquestador verificando caso exitoso y caso de fallback.

## Phase 4: Integración en `quoteProcessingService.ts`
- [x] 4.1 Integrar la llamada al orquestador en `server/src/services/quoteProcessingService.ts` protegida por `featureFlags.isEnabled('enableTwoStageExtraction')`.
- [x] 4.2 Probar que el pipeline tradicional sigue ejecutándose limpiamente cuando la bandera está desactivada.

## Phase 5: Verificación y Sincronización Engram
- [x] 5.1 Ejecutar `npm run typecheck:frontend` y `npm run typecheck:backend`.
- [x] 5.2 Ejecutar suite completa de tests (`npm test`).
- [x] 5.3 Registrar avance en Engram y cerrar la fase.
