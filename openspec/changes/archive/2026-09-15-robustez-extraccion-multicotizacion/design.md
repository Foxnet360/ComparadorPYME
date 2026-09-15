# Design: Robustez de Extracción Multicotización y Reparación de JSON

## Architecture Overview

```
                 LLM Response (6+ Cotizaciones)
                             │
                             ▼
              ┌──────────────────────────────┐
              │ stripMarkdownFences(raw)     │ <── Quita ```json y markdown fences
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │ detectFormat()               │ === 'json' garantizado
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │ parseJsonWithRepair()        │ <── Rescata { insurers, rows }
              │ (con soporte V2 granular)    │     aun con cortes de cierre
              └──────────────┬───────────────┘
                             │
                   ┌─────────┴─────────┐
             ¿Parse Exitoso?       ¿Fallo crítico?
                   │                       │
                  SÍ                       NO
                   │                       │
                   ▼                       ▼
           buildV2Result()     Retry con LLM:
         (30+ filas intactas,   - Adjunta uploadedFiles (PDFs)
         primas y deducibles)   - Envía JSON completo sin truncar a 1000 chars
```

## Key Decisions

1. **Pre-procesamiento Determinístico (`stripMarkdownFences`):**
   - No delegar en el LLM la eliminación de wrappers markdown. Una expresión regular (`^```(?:json)?\s*([\s\S]*?)\s*```$`) o recorte de delimitadores antes de `detectFormat` previene el 90% de los fallos de parseo en el intento 1.

2. **Reparador de JSON Consciente de V2 (`jsonRepair.ts`):**
   - Extender las heurísticas para detectar arrays de `rows` incompletos.
   - Si un array de `rows` termina abruptly sin cerrar corchetes (común en respuestas que rozan el límite de tokens), cerrar la última celda/fila abierta y completar los corchetes para que el parser obtenga el 95% de las filas intactas.

3. **Corrección con Archivos Adjuntos (`UnifiedComparisonEngine`):**
   - Cuando realmente sea necesario recurrir al prompt de corrección (`comparisonPromptBuilder`), re-adjuntar los `uploadedFiles` (archivos PDF ya subidos en la File API de Gemini) en `contents`.
   - Esto garantiza que si el LLM debe reescribir la tabla, tenga la fuente documental para rellenar las primas y deducibles y no reduzca la respuesta a 4 filas vacías.
