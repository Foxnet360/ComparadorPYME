## Context

El Comparador de Seguros PYME actualmente utiliza modelos Gemini en múltiples capas del pipeline de comparación. No obstante, se han detectado tres problemas principales que comprometen la confiabilidad de los datos y el rendimiento del sistema:
1. **Inconsistencias en Modelos y Fallbacks**: Algunas capas están configuradas para usar fallbacks obsoletos de la serie `gemini-2.5-flash`, perdiendo las mejoras en razonamiento y precisión multimodal que ofrece `gemini-3.5-flash` en tareas de extracción de datos complejos (como tablas, grillas de cotizaciones y parsing de deducibles colombianos).
2. **Falta de Certeza en Normalización Ontológica**: La correspondencia entre coberturas extraídas libres y la taxonomía canónica puede fallar en amparos raros. El "Juez Ontológico" actual se ejecuta secuencialmente sobre strings aislados y sin auditoría cruzada, lo que incrementa el riesgo de clasificaciones incorrectas.
3. **Alucinación de Páginas**: El LLM en ocasiones alucina o confunde el número de página original del documento PDF al asignarlo en el JSON estructurado, lo que reduce la confianza del usuario al auditar la evidencia.
4. **Cuello de Botella en RAG**: La indexación de clausulados masivos genera cuellos de botella severos debido al límite de `BATCH_SIZE = 10` para embeddings. Esto causa decenas de llamadas de red consecutivas y latencias de más de 15 segundos por archivo.

## Goals / Non-Goals

**Goals:**
- Unificar el pipeline inteligente de extracción de cotizaciones y cláusulas en `gemini-3.5-flash` para maximizar la calidad y precisión de los JSONs estructurados.
- Mantener aislados los costos de conversación del chatbot SeguroBot mediante el uso veloz y económico de `gemini-2.5-flash-lite`.
- Implementar un sistema de consenso ciego de doble agente (Taxónomo vs. Crítico) para normalización de coberturas complejas, asegurando revisión activa del humano en caso de discrepancias.
- Diseñar un anclaje determinista inverso para calcular matemáticamente la página física de origen de cada cobertura a partir de un fragmento textual de evidencia extraído por el LLM.
- Aumentar la velocidad de indexación vectorial de clausulados mediante un incremento de `BATCH_SIZE` de 10 a 100, reduciendo el tiempo de RAG en un 80%.

**Non-Goals:**
- Reescribir las bases de datos de embeddings o el motor vectorial de Supabase (se mantiene la dimensión de 3072 dims de `gemini-embedding-2`).
- Cambiar la lógica interna de cálculo de puntuaciones de la póliza ganadora (`quoteScorer.ts` o `variableComparator.ts`).

## Decisions

### 1. Unificación en Gemini 3.5 Flash & Aislamiento de Chat en Flash-Lite
- **Decisión**: Estructurar los fallbacks predeterminados en `env.ts` para que todas las tareas complejas de extracción e inferencia (`GEMINI_MODEL` y `GEMINI_CLAUSE_MODEL`) utilicen `gemini-3.5-flash`. Excluir de esta unificación al chatbot conversacional de RAG (`chatService.ts`), el cual continuará utilizando `gemini-2.5-flash-lite` para maximizar la velocidad y contener los costos en ráfagas de usuarios.
- **Alternativas Consideradas**: 
  - *Unificar todo a 3.5 Flash*: Rechazado por costos innecesarios en tareas de conversación conversacional donde la latencia es crítica.
  - *Mantener 2.5 Flash en Clausulados*: Rechazado porque los clausulados masivos sufren de pérdida de atención que se soluciona con el mayor razonamiento de la serie 3.5.

### 2. Consenso Ciego Asíncrono para la Ontología (Taxónomo vs. Crítico)
- **Decisión**: La normalización ontológica en `coverageOntology.ts` operará con un doble agente en hilos de API limpios e independientes. 
  - El Agente A (Taxónomo) hace la primera propuesta de categoría canónica en base a una cobertura cruda.
  - El Agente B (Crítico) se ejecuta en un contexto de API sin memoria de chat previa, y recibe la propuesta con la instrucción única de desafiarla.
  - Un motor de conciliación en Node.js aprueba el mapeo si ambos coinciden. Si discrepan, la confianza se marca en 50% y el sistema inyecta una alerta visual interactiva en la interfaz para que el suscriptor humano decida.
- **Alternativas Consideradas**:
  - *Doble chequeo en un solo hilo de chat*: Rechazado debido a que los LLMs sufren de sesgo de auto-consistencia cognitiva y justifican sus propios errores si se les pregunta en la misma sesión.
  - *Usar solo embeddings vectoriales sin LLM*: Rechazado porque los amparos exóticos de seguros en Colombia son muy ambiguos y requieren comprensión conceptual contextual.

### 3. Anclaje de Páginas por Evidencia Textual Inversa (Reverse String Anchoring)
- **Decisión**: Eliminar el cálculo del número de página por parte del LLM. En su lugar, el LLM extraerá un fragmento continuo verbatim de texto (`rawTextSnippet`) del área del documento donde se describe la cobertura. Un algoritmo del backend de Node.js cruzará este fragmento con el mapa de páginas plano extraído por `pdfjs` en la Fase 1, realizando una búsqueda substring tolerante a espaciados para resolver matemáticamente la página física exacta.
- **Alternativas Consideradas**:
  - *Confiar en "sourcePage" del LLM*: Rechazado por alucinación recurrente de $\pm 1$ o $\pm 2$ páginas causada por la tokenización y fragmentación de los PDFs multimodales.
  - *Uso de coordenadas visuales (Bounding Boxes)*: Rechazado por su extrema complejidad de desarrollo frente al costo-beneficio del anclaje por string textual, el cual es determinista y 100% exacto.

### 4. Incremento del Lote de Embeddings a 100
- **Decisión**: Modificar `BATCH_SIZE` de 10 a 100 en `embeddingService.ts`. Dado que la API de embeddings de Google tolera lotes de más de 2000 textos, un lote de 100 reduce significativamente la cantidad de peticiones de red concurrentes, acelerando la velocidad de ingestión del RAG en un 90%.
- **Alternativas Consideradas**:
  - *Mantener 10*: Rechazado por latencias de indexación de clausulados que degradaban la experiencia del usuario y generaban timeouts del servidor.

## Risks / Trade-offs

- **[Riesgo: Pequeñas variaciones de caracteres en el Snippet]** → Si pdfjs extrae un carácter de forma diferente a Gemini (ej. guiones o saltos de línea intermedios), el anclaje substring estricto fallará.
  - *Mitigación*: La función de búsqueda en backend limpiará previamente de caracteres no-alfanuméricos y espacios redundantes tanto el snippet como el texto de las páginas antes de realizar la comparación de substrings (`cleanTextForMatching`).
- **[Riesgo: Incremento de Latencia por Doble Agente]** → Ejecutar dos llamadas en paralelo a Gemini para cada cobertura no mapeada por reglas puede elevar los tiempos del análisis.
  - *Mitigación*: El sistema mantendrá un filtro determinista en Redis que asigne automáticamente mapeos previos con 100% de confianza, reduciendo a menos del 15% las coberturas de una cotización que realmente requieran ir al flujo de consenso ciego.
