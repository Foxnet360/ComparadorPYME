# Tasks: Tubería Multimodal Holística y Citas de Evidencia

## Phase 1: Esquema de Evidencia y Modelos de Datos
- [x] 1.1 Extender `UnifiedQuote` y `ComparisonResultQuote` para incluir `pageNumber`, `sourceSnippet` y `confidenceScore` en `types.ts` y `server/src/types/unifiedComparison.ts`.

## Phase 2: Prompts Multimodales y Auditoría en 2 Pasos
- [x] 2.1 Actualizar `comparisonPromptBuilder.ts` para obligar la extracción de citas de texto y páginas exactas en la ingesta de Gemini 2.5/3.5 Vision.
- [x] 2.2 Crear el servicio de auditoría `groundingAuditor.ts` que efectúa el Pase 2 de reconciliación contra el documento PDF original.

## Phase 3: Visualización de Citas en la Interfaz de Usuario
- [x] 3.1 Actualizar `ComparisonReport.tsx` y `UnifiedCoverageMatrix.tsx` para mostrar insignias con el número de página (ej: `📄 Pág. 4`) y un tooltip con la cita textual de evidencia al pasar el cursor.

## Phase 4: Verificación & Despliegue
- [x] 4.1 Ejecutar suite de pruebas unitarias con `npm test`.
- [x] 4.2 Compilar el proyecto completo con `npm run build` y desplegar en Railway.
