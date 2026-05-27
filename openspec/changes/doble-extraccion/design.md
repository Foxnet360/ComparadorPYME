## Context

La implementación del comparador de seguros PYME (`comparador-csa`) ha avanzado hacia un modelo de comprensión fluida (V2) basado en la extracción multimodal directa mediante la API de Gemini. No obstante, persisten vulnerabilidades críticas en la robustez y calidad de la información debido a la existencia de simuladores heurísticos en el backend (doble extracción mediante expresiones regulares) y lógicas frágiles de parseo de JSON e inferencia de formatos. En el frontend, un error en la precedencia lógica del formateador de celdas impide que los usuarios finales visualicen la normalización estructurada de los deducibles compuestos de Colombia, mostrando en su lugar el texto plano del OCR. Este diseño técnico establece el mapa de decisiones arquitectónicas y flujos necesarios para solventar estas deficiencias de forma segura y coordinada.

## Goals / Non-Goals

**Goals:**
- Garantizar un 100% de paridad sintáctica y paridad de tipado en la extracción de cláusulas estructuradas mediante el uso de schemas rígidos nativos en la API de Gemini (`responseSchema`).
- Reactivar el mecanismo anti-alucinación real en coberturas de alta criticidad (Incendio y Responsabilidad Civil) realizando una doble extracción independiente en el backend para detectar discrepancias estadísticas.
- Lograr una clasificación de formato familiar inmune al renombrado de archivos físicos mediante escaneo textual nativo preliminar.
- Corregir el bug visual de prioridad en la matriz comparativa para asegurar la correcta renderización de deducibles normalizados estructurados.
- Evitar el recorte visual de tooltips de deducibles en contenedores con scroll horizontal.

**Non-Goals:**
- Modificar el motor de base de datos principal o alterar el diseño relacional de las tablas `coverage_mappings` o `structured_clauses`.
- Reemplazar el backend legacy RAG (V1) en su totalidad; se conservan las compatibilidades y feature flags para rollback inmediato.

## Decisions

### 1. Enforzamiento de Schema en `structuredClauseExtractor.ts`
- **Decisión:** Definir un esquema formal utilizando `Type` de la librería `@google/genai` e inyectarlo en la propiedad `config.responseSchema` con `responseMimeType: 'application/json'`.
- **Razón:** Elimina la necesidad de usar expresiones regulares para buscar llaves `{}` dentro del texto libre devuelto por el modelo, lo cual es inestable y causa fallos de ejecución. Garantiza que el JSON devuelto siempre cumpla estrictamente la interfaz `StructuredClause`.
- **Alternativas consideradas:** Mantener la extracción basada en texto libre pero agregar una librería robusta de reparación de JSON (ej: `jsonRepair.ts`). Rechazado debido a que la enforzación en tiempo de inferencia es más económica y rápida.

### 2. Doble Extracción Real en `dualExtractionService.ts`
- **Decisión:** Reemplazar el extractor regex por una llamada API secundaria real a Gemini utilizando el modelo veloz `gemini-2.5-flash` con una temperatura ligeramente diferente (0.3) y un prompt de verificación enfocado exclusivamente en las coberturas críticas detectadas.
- **Razón:** Cumple con la especificación anti-alucinaciones original. Al cruzar dos llamadas de modelos con parámetros térmicos distintos se pueden identificar discrepancias y falsos positivos con una certeza estadística real.
- **Alternativas consideradas:** Usar visión artificial (multimodal) para la segunda llamada. Rechazado por costos de token y latencia, ya que el texto nativo ya extraído en fase 2.5 proporciona perfecta fidelidad de caracteres para Incendio y RC.

### 3. Clasificación Dinámica por Escaneo de Texto en `quoteProcessingService.ts`
- **Decisión:** Implementar un escáner regex rápido sobre los primeros 1000 caracteres de `nativeText` en la fase 1.5 del procesamiento para buscar patrones característicos de nombres de aseguradoras nacionales.
- **Razón:** El nombre del archivo físico es manipulable por el usuario. La presencia de palabras clave dentro del documento nativo es un indicador infalible del emisor.
- **Alternativas consideradas:** Llamar a un LLM clasificador. Rechazado por agregar latencia innecesaria de red; el escaneo regex local de texto es instantáneo y tiene 99% de acierto para las 6 aseguradoras objetivo.

### 4. Prioridad de Formateo Invertida en `VariableComparisonMatrix.tsx`
- **Decisión:** Reestructurar la función `formatDeductible` para priorizar la lectura del campo `deductible.normalized` (porcentaje, minAmount, maxAmount). Si los valores normalizados son válidos, se formatea en cadena limpia; en caso contrario, se retorna `deductible.rawText`.
- **Razón:** Corrige el bug lógico donde la existencia de `rawText` bloqueaba de forma permanente el flujo hacia el bloque `normalized`, dejando la interfaz inutilizable a nivel de diseño premium.

### 5. Tooltips Flotantes Resilientes en `DeductibleBadge.tsx`
- **Decisión:** Cambiar el tooltip de `absolute` a `relative` con un z-index elevado (`z-50`) o implementar una clase que posicione el tooltip de forma fija basada en coordenadas en pantalla para evitar el clipping dentro del contenedor `overflow-x-auto`.
- **Razón:** Previene la mala experiencia de usuario donde información clave del deducible se oculta detrás de la barra de scroll.

## Risks / Trade-offs

- **[Riesgo] Incremento de Latencia en Extracción de Cotizaciones**
  - *Mitigación:* La llamada de la doble extracción se ejecutará en paralelo utilizando promesas concurrentes (`Promise.all`) con la normalización y análisis primarios para evitar impactos significativos en el tiempo de respuesta total de la carga.
- **[Riesgo] Incremento de Costos por Consumo de API en Gemini**
  - *Mitigación:* La segunda llamada se limita únicamente a las 2 coberturas de mayor impacto (Incendio y RC), enviando fragmentos ultra-cortos de contexto para conservar tokens de entrada.
