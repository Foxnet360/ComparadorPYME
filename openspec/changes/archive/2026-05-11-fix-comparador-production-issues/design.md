## Context

El Comparador PYME está en producción en Railway y presenta 6 bugs críticos que afectan la experiencia de los corredores de seguros:

1. **Tesauro no carga**: Archivos `tesauro(pyme).md` y `tesauro-extensiones.md` existen en repo root pero no se incluyen en la imagen Docker. Railway muestra: `"Thesaurus file not found, using built-in thesaurus"`. Esto causa que todas las coberturas tengan `categoryId: undefined`.

2. **Modelo Gemini incorrecto**: Railway tiene `GEMINI_MODEL=gemini-2.5-flash` pero el código solo activa el modelo Pro cuando `USE_PRO_MODEL='true'`. El usuario quiere usar `gemini-2.5-pro` cambiando solo la env var.

3. **Regex de deducibles roto**: `normalizeDeductible()` usa `/(<d+%)/` que falla con espacios ("10 %") y no maneja formatos reales como `"10 % PERD Min 1 (SMMLV)"`.

4. **Valores corruptos**: Gemini mezcla `value` y `deductible` en extracción. Ejemplo: RC muestra "25 COP" en vez de "$300.000.000". El prompt no instruye separación explícita.

5. **Matriz desalineada**: `UnifiedCoverageMatrix.tsx` busca por `categoryId` que es `undefined` cuando tesauro falla. No hay fallback por nombre canónico.

6. **Chat sin contexto**: `chatService.ts` solo usa RAG. Cuando `match_clauses` retorna vacío (tabla `clause_chunks` vacía o query sin matches), responde `"No tengo información suficiente"` a pesar de tener datos de cotizaciones en `reportContext`.

## Goals / Non-Goals

**Goals:**
- Hacer que el tesauro cargue correctamente en Railway
- Permitir cambiar modelo Gemini desde env var sin tocar código
- Parsear correctamente formatos de deducibles reales (espacios, porcentaje + mínimo)
- Separar valor y deducible en extracción para evitar corrupción
- Alinear matriz de coberturas incluso sin tesauro usando fuzzy matching
- Proveer respuestas útiles en chat usando datos de cotizaciones cuando RAG falla

**Non-Goals:**
- No migrar de `clause_chunks` a `chunks` (ya está en otro change)
- No implementar nuevas funcionalidades de análisis avanzado
- No cambiar la UI visual (colores, layout)
- No modificar env files (prohibido por el usuario)

## Decisions

### Decision 1: Copiar tesauro en Dockerfile vs bundling en build
**Opción A**: Agregar `COPY tesauro*.md /app/` en Dockerfile
**Opción B**: Incluir tesauro en el bundle de build (ej: copiar a `server/dist/`)
**Elegida**: Opción A
**Rationale**: Es la solución más simple y directa. El código actual busca en `process.cwd()` que es `/app/` en Railway. Copiar los archivos al contenedor asegura que estén disponibles sin modificar la lógica de búsqueda.
**Alternativas**: Bundling requeriría modificar `thesaurusMapper.ts` para buscar en rutas relativas al bundle, lo cual es más complejo y propenso a errores.

### Decision 2: Leer GEMINI_MODEL directamente vs feature flag boolean
**Opción A**: Leer `GEMINI_MODEL` env var directamente
**Opción B**: Mantener `USE_PRO_MODEL=true/false` y mapear internamente
**Elegida**: Opción A
**Rationale**: El usuario quiere cambiar el modelo desde Railway Dashboard sin tocar código. Leer directamente `GEMINI_MODEL` permite especificar cualquier modelo (`gemini-2.5-pro`, `gemini-2.5-flash`, etc.) sin modificaciones.
**Alternativas**: Boolean limita a dos opciones y requiere deploy de código para cambiar.

### Decision 3: Regex robusto para deducibles vs parsing semántico
**Opción A**: Regex mejorado que maneje espacios, porcentaje, mínimo
**Opción B**: LLM-based parsing (llamar a Gemini para normalizar)
**Elegida**: Opción A
**Rationale**: Regex es más rápido, determinista y no requiere llamadas API adicionales. Los formatos son predecibles (número + % + texto + mínimo + SMMLV).
**Patrón regex propuesto**: `/(\d+(?:\s*%|%))\s*(.*?)\s*(?:Min\s+(\d+)\s*(?:\(SMMLV\)|SMMLV))?/gi`
**Riesgo**: Podría no cubrir todos los formatos. Mitigación: logs de "formato no reconocido" + fallback al texto original.

### Decision 4: Fortalecer prompt vs post-processing
**Opción A**: Mejorar el prompt de Gemini para separar value/deductible
**Opción B**: Post-procesar el JSON y detectar/corregir mezclas
**Elegida**: Ambas (defensa en profundidad)
**Rationale**: Mejorar el prompt previene el problema. Post-processing (validación) detecta casos que el prompt no evitó.
**Validación**: Si `value` < $100M para RC/Incendio → flag como sospechoso. Si `deductible` contiene "$" o números grandes → posible mezcla.

### Decision 5: Fuzzy matching en frontend vs backend
**Opción A**: Implementar fuzzy matching en `UnifiedCoverageMatrix.tsx` (frontend)
**Opción B**: Normalizar nombres en backend antes de enviar al frontend
**Elegida**: Opción A (frontend)
**Rationale**: Es un fix rápido sin modificar el backend. El backend ya envía `canonicalName`. El frontend puede hacer fuzzy matching entre `canonicalName` y las 14 categorías estándar.
**Librería**: Implementación simple de Levenshtein distance o incluso `toLowerCase().includes()` para las variaciones conocidas ("RC" ↔ "Responsabilidad Civil").

### Decision 6: Chat fallback a reportContext
**Opción A**: Modificar `chatService.ts` para incluir reportContext siempre
**Opción B**: Usar reportContext solo cuando RAG retorna vacío
**Elegida**: Opción B
**Rationale**: Si RAG tiene datos, es mejor usarlos (más específicos). Fallback a reportContext solo cuando RAG falla evita duplicar información y mantiene la calidad cuando hay clausulados disponibles.
**Implementación**: En `buildPrompt()`, si `ragChunks.length === 0`, construir un contexto de cotizaciones resumido desde `reportContext`.

## Risks / Trade-offs

- **[Riesgo] El regex de deducibles no cubre todos los formatos reales** → Mitigación: Crear test script con ejemplos de los 4 clientes. Fallback: mostrar texto original sin parsear.
- **[Riesgo] Cambiar GEMINI_MODEL puede causar issues con quotas o precios** → Mitigación: El usuario controla el cambio. Documentar que `gemini-2.5-pro` tiene mayor precisión pero posiblemente mayor latencia/costo.
- **[Riesgo] Fuzzy matching en frontend puede causar falsos positivos** → Mitigación: Mostrar badge de "match aproximado" y tooltip con nombre original.
- **[Riesgo] Deploy a Railway podría fallar si Dockerfile cambia** → Mitigación: Push a rama primero (no main), testear en staging si existe.
- **[Riesgo] Chat con reportContext puede dar respuestas menos precisas** → Mitigación: Aclarar en la respuesta que la información proviene de las cotizaciones, no de los clausulados.

## Migration Plan

1. **Implementar fixes en rama `hotfix/production-issues`**
2. **Crear test script** para validar regex de deducibles con ejemplos reales
3. **Build local** para verificar sin errores TypeScript
4. **Push a GitHub** (rama `hotfix/production-issues`)
5. **Deploy a Railway** desde la rama (si es posible) o merge a main
6. **Cambiar env var** `GEMINI_MODEL=gemini-2.5-pro` en Railway Dashboard
7. **Verificar**: Matriz, deducibles, chat, tesauro logs
8. **Merge a main** después de confirmar funcionamiento

## Open Questions

1. ¿Cuál es la ruta exacta donde `thesaurusMapper.ts` busca los archivos? ¿Es `process.cwd()` o otra?
2. ¿Los ejemplos de deducibles de MAPFRE son representativos de todas las aseguradoras?
3. ¿Existe un entorno de staging en Railway para testear antes de producción?
