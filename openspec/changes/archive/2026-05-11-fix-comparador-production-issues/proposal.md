## Why

Los usuarios del Comparador PYME en producción (Railway) reportan datos corruptos y funcionalidades inoperantes: la matriz de coberturas muestra valores desalineados (ej: RC mostrando "$25 COP" en vez de "$300.000.000"), los deducibles aparecen como "$10" en vez de su formato real (ej: "10% PERD Min 1 SMMLV"), el chatbot responde "No tengo información suficiente" a pesar de tener datos de cotizaciones, y el tesauro no carga en producción. Estos errores bloquean el análisis de cotizaciones y generan desconfianza en los corredores.

## What Changes

### Fix 1: Tesauro en Docker/Railway
- Incluir archivos `tesauro(pyme).md` y `tesauro-extensiones.md` en la imagen Docker para que el servicio los encuentre en `process.cwd()`
- Verificar que `thesaurusMapper.ts` resuelva correctamente la ruta en producción

### Fix 2: Selección de Modelo Gemini
- Modificar `gemini.ts` para leer directamente la variable de entorno `GEMINI_MODEL` en vez de depender de `USE_PRO_MODEL=true/false`
- Esto permite cambiar el modelo desde Railway Dashboard sin modificar código

### Fix 3: Regex de Deducibles
- Corregir `normalizeDeductible()` en `thesaurusMapper.ts` para manejar formatos complejos reales:
  - `"10 % PERD Min 1 (SMMLV)"` (espacio antes del `%`)
  - `"Sin deducible"` → `null` (no `"0"`)
  - Combinaciones de porcentaje + mínimo
- Agregar test script con ejemplos reales de MAPFRE para validación

### Fix 4: Separación Valor vs Deducible en Extracción
- Fortalecer el prompt de Gemini en `analysisController.ts` para separar explícitamente:
  - `value`: Monto asegurado (ej: "$300.000.000")
  - `deductible`: Cuota de participación (ej: "10% PERD Min 1 SMMLV")
- Agregar validación post-extracción que detecte valores sospechosos

### Fix 5: Alineación de Matriz sin Tesauro
- Mejorar `UnifiedCoverageMatrix.tsx` con fallback de matching fuzzy cuando `categoryId` es undefined
- Manejar variaciones de nombres como "RC" vs "Responsabilidad Civil"

### Fix 6: Contexto del Chat
- Modificar `chatService.ts` para usar `reportContext` (datos de cotizaciones) cuando RAG no retorna clauses
- Evitar que el chat responda "no tengo información" cuando sí hay datos de cotizaciones

## Capabilities

### New Capabilities
- `tesauro-docker-deployment`: Garantizar que los archivos de tesauro estén disponibles en el entorno de producción Docker

### Modified Capabilities
- `deductible-formatting`: Requerimiento modificado - el sistema DEBE parsear correctamente formatos complejos de deducibles reales (porcentaje + mínimo SMMLV) además de los formatos simples
- `coverage-value-formatting`: Requerimiento modificado - el sistema DEBE separar valores de deducibles durante la extracción para evitar corrupción de datos
- `chat-with-rag`: Requerimiento modificado - el chat DEBE usar contexto de cotizaciones como fallback cuando RAG no retorna resultados
- `unified-coverage-matrix`: Requerimiento modificado - la matriz DEBE alinearse correctamente incluso cuando el tesauro no está disponible, usando matching fuzzy por nombre
- `pdf-text-extraction`: Requerimiento modificado - la extracción DEBE separar explícitamente campos `value` y `deductible` en el prompt y validar el resultado

## Impact

### Backend
- `server/src/services/thesaurusMapper.ts` - Fix regex y carga de tesauro
- `server/src/services/gemini.ts` - Leer GEMINI_MODEL env var
- `server/src/controllers/analysisController.ts` - Mejorar prompt y validación
- `server/src/services/chatService.ts` - Fallback a reportContext
- `Dockerfile` - Incluir tesauro*.md en imagen
- Nuevo: `scripts/test-deductible-regex.ts` - Test script para validar regex

### Frontend
- `components/UnifiedCoverageMatrix.tsx` - Fallback matching fuzzy

### Infraestructura
- `Dockerfile` - Agregar COPY para archivos de tesauro
- Variables de entorno: `GEMINI_MODEL` (ya existe, ahora se usa directamente)

### Dependencias
- Requiere deploy a Railway para verificar tesauro carga correctamente
- Requiere cambio manual en Railway Dashboard: `GEMINI_MODEL=gemini-2.5-pro`
