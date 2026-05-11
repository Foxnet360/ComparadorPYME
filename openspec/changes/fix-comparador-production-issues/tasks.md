## 1. Fix Tesauro en Docker

- [x] 1.1 Modificar `Dockerfile` para copiar `tesauro(pyme).md` y `tesauro-extensiones.md` al directorio de trabajo (`/app/`)
- [x] 1.2 Verificar que `thesaurusMapper.ts` busca en `process.cwd()` y resuelve correctamente en Railway
- [x] 1.3 Agregar log de confirmación cuando tesauro se carga exitosamente
- [ ] 1.4 Testear build local de Docker para confirmar archivos están en imagen

## 2. Fix Selección de Modelo Gemini

- [x] 2.1 Modificar `server/src/services/gemini.ts` para leer `GEMINI_MODEL` env var directamente
- [x] 2.2 Remover o deprecar lógica de `USE_PRO_MODEL` boolean
- [x] 2.3 Agregar validación que `GEMINI_MODEL` esté definido (fallback a `gemini-2.5-flash`)
- [x] 2.4 Loguear el modelo seleccionado al iniciar el servicio

## 3. Fix Regex de Deducibles

- [x] 3.1 Analizar formatos reales de deducibles de los 4 clientes (MAPFRE, SBS, HDI, AXA)
- [x] 3.2 Actualizar `normalizeDeductible()` en `server/src/services/thesaurusMapper.ts` con regex robusto
- [x] 3.3 Manejar casos: espacio antes de %, "Sin deducible", formato completo (%, PERD, Min, SMMLV)
- [x] 3.4 Crear `scripts/test-deductible-regex.ts` con ejemplos reales para validación
- [x] 3.5 Ejecutar test script y confirmar todos los formatos pasan

## 4. Fix Separación Valor vs Deducible

- [x] 4.1 Fortalecer prompt en `analysisController.ts` para separar explícitamente `value` y `deductible`
- [x] 4.2 Agregar ejemplos en el prompt de extracción correcta vs incorrecta
- [x] 4.3 Implementar validación post-extracción: detectar valores sospechosos (RC < $100M)
- [x] 4.4 Implementar validación: si `deductible` contiene "$" o montos grandes, flaggear mezcla
- [ ] 4.5 Testear extracción con cotizaciones de ejemplo para verificar separación correcta

## 5. Fix Alineación de Matriz

- [x] 5.1 Implementar función de fuzzy matching en `UnifiedCoverageMatrix.tsx`
- [x] 5.2 Manejar variaciones: "RC" ↔ "Responsabilidad Civil", "Incendio" ↔ "Incendio (Edificio y Contenidos)"
- [x] 5.3 Mostrar badge "Match aproximado" cuando se usa fuzzy matching
- [x] 5.4 Mantener tooltip con nombre original del PDF
- [ ] 5.5 Verificar que matriz se alinea correctamente incluso cuando tesauro no carga

## 6. Fix Contexto del Chat

- [x] 6.1 Modificar `chatService.ts` para construir contexto de cotizaciones desde `reportContext`
- [x] 6.2 Implementar lógica: si RAG retorna vacío, usar reportContext como fallback
- [x] 6.3 Formatear datos de cotizaciones de forma legible para el prompt
- [x] 6.4 Aclarar en respuesta que información proviene de cotizaciones (no clausulados)
- [ ] 6.5 Testear chat con pregunta sobre deducible cuando no hay clausulados indexados

## 7. Testing y Validación

- [ ] 7.1 Ejecutar test suite existente (`npm test`) - verificar no hay regressions
- [x] 7.2 Testear build local (`npm run build`) sin errores TypeScript
- [x] 7.3 Ejecutar test script de deducibles contra todos los formatos conocidos
- [ ] 7.4 Verificar que tesauro carga correctamente (logs)
- [ ] 7.5 Verificar que modelo Gemini seleccionado es el correcto (logs)

## 8. Deploy y Verificación

- [x] 8.1 Crear rama `hotfix/production-issues` y push a GitHub
- [ ] 8.2 Verificar build en CI/CD (si existe)
- [ ] 8.3 Deploy a Railway (staging si existe, sino producción con precaución)
- [ ] 8.4 Cambiar env var `GEMINI_MODEL=gemini-2.5-pro` en Railway Dashboard
- [ ] 8.5 Verificar en producción: matriz alineada, deducibles correctos, chat funcional, tesauro cargado
- [ ] 8.6 Monitorear logs por 30 minutos post-deploy
- [ ] 8.7 Merge rama a `main` una vez confirmado estable
