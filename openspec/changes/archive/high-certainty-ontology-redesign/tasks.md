## 1. Configuración de Entorno y Batch de Embeddings

- [x] 1.1 Modificar fallbacks predeterminados en `server/src/config/env.ts` para establecer `gemini-3.5-flash` como default en `GEMINI_MODEL` y `GEMINI_CLAUSE_MODEL`.
- [x] 1.2 Ajustar `EMBEDDING_MODEL_NAME` a `gemini-embedding-2` y `EMBEDDING_DIMENSIONS` a 3072 en `server/src/services/vector/embeddingService.ts`.
- [x] 1.3 Incrementar la constante `BATCH_SIZE` de 10 a 100 en `server/src/services/vector/embeddingService.ts`.
- [x] 1.4 Modificar el bloque `generateEmbeddingsBatch` para procesar lotes concurrentes secuenciales de 100 con delay de seguridad.

## 2. Ingestión Multimodal Verbatim (Fase 2)

- [x] 2.1 Actualizar el esquema `QuoteExtractionSchemaV2` en `server/src/services/gemini.ts` para incorporar los campos `rawTextSnippet` (string) a nivel de cobertura.
- [x] 2.2 Ajustar el prompt base de la Fase 2 en `server/src/services/quoteProcessingService.ts` e inyectar instrucciones estrictas para extraer la evidencia textual literal de forma verbatim.
- [x] 2.3 Modificar `pdfExtractor.ts` para que la función principal de extracción de PDF retorne una estructura por páginas `Record<number, string>`.
- [x] 2.4 Almacenar de forma temporal la estructura de páginas `PageTextMap` durante el flujo de procesamiento de cotizaciones en `quoteProcessingService.ts`.

## 3. Consenso Ciego de Doble Agente (Fase 4)

- [x] 3.1 Crear la infraestructura en `server/src/services/coverageOntology.ts` para instanciar el Agente A (Taxónomo) y el Agente B (Crítico).
- [x] 3.2 Implementar la llamada de API sin memoria y aislada del Agente B (Crítico) con el prompt de auditoría semántica.
- [x] 3.3 Desarrollar el motor de conciliación lógica local en `coverageOntology.ts` que compare los outputs de ambos agentes.
- [x] 3.4 Configurar la asignación de confianza (95% si hay coincidencia, 50% y flag de revisión manual `needs_human_review = true` en base de datos si hay discrepancias).
- [x] 3.5 Integrar la consulta rápida a caché de Redis en el flujo para evitar llamadas innecesarias a los agentes LLM ante mapeos pre-existentes idénticos.

## 4. Anclaje Determinista de Páginas en Backend

- [x] 4.1 Implementar la función de utilidad `findExactPageForSnippet` en el backend para realizar búsquedas substring tolerantes a espaciado.
- [x] 4.2 Añadir la limpieza previa de caracteres no-alfanuméricos a nivel de comparación substring para evitar falsos negativos en coincidencias.
- [x] 4.3 Acoplar el resultado de la búsqueda de páginas con el objeto de cobertura final retornado al cliente.

## 5. Refinamiento del Motor de Aprendizaje (HITL)

- [x] 5.1 Modificar el esquema de la tabla de Supabase `coverage_mappings` (o el servicio `learningEngine.ts`) para soportar columnas adicionales como snippet de evidencia, justificación de IA y página calculada.
- [x] 5.2 Implementar en `learningEngine.ts` la búsqueda vectorial de las 3 correcciones de usuario anteriores más similares utilizando similitud coseno sobre embeddings de 3072 dimensiones.
- [x] 5.3 Modificar el prompt del Agente A (Taxónomo) para inyectar dinámicamente las 3 correcciones históricas recuperadas como ejemplos pocos disparos (few-shots).

## 6. Interfaces de Usuario y Verificación Visual

- [x] 6.1 Modificar la interfaz del comparador (frontend) para que las celdas con confianza del 50% se resalten visualmente (bordes de alerta en amarillo o rojo).
- [x] 6.2 Implementar el Dropdown Contextual Inline de selección en grilla para resolver discrepancias en caliente con 1 clic.
- [x] 6.3 Crear el Tooltip de Hover de Auditoría en grilla que muestre el fragmento exacto de evidencia del PDF y la página exacta calculada por el backend.
- [x] 6.4 Diseñar y desplegar la Consola del Curador (Dashboard) para administradores integrando métricas y tendencias de aprendizaje.
