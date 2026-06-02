## 1. Ajustes de Timeouts de Ejecución

- [x] 1.1 Modificar `unifiedComparisonEngine.ts` para incrementar `TIMEOUT_MS` de 45 a 90 segundos.
- [x] 1.2 Modificar `analysisController.ts` para incrementar el timeout por defecto de `callWithTimeout` de 5 a 15 segundos.

## 2. Normalización de Nombres de Aseguradoras en RAG y Validaciones

- [x] 2.1 Modificar `clauseCoverageValidator.ts` para importar y usar `insurerNameNormalizer` en `validate`, `checkClauseDocumentExists` y `extractCoveragesFromClause`.
- [x] 2.2 Modificar `inverseCoverageChecker.ts` para importar y usar `insurerNameNormalizer` en `checkMissingCoverages` y `extractClauseCoverages`.
- [x] 2.3 Modificar `clauseVersionComparator.ts` para importar y usar `insurerNameNormalizer` en `getVersionHistory`.
- [x] 2.4 Modificar `vectorStore.ts` para importar y usar `insurerNameNormalizer` en `listDocuments`.

## 3. Pruebas y Verificación de Integración

- [x] 3.1 Ejecutar prueba automatizada local `test-rag-retrieval.ts` cargando las credenciales reales desde `.env.local` usando `DOTENV_CONFIG_PATH=../.env.local` y comprobar la correcta recuperación de clausulados para SBS e HDI.
- [x] 3.2 Iniciar el servidor local en modo desarrollo y realizar una petición de prueba para comprobar que el motor unificado de comparación no genera timeouts.
- [x] 3.3 Validar que en la interfaz de usuario de auditoría de riesgos de cotizaciones se visualice "Análisis enriquecido con clausulados" y se listen correctamente las cláusulas de SBS / HDI sin penalizaciones artificiales.
