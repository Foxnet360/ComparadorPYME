## Context

El Comparador de Seguros CSA utiliza un backend híbrido (Node.js, Express, Supabase) y modelos de lenguaje de Google Gemini para auditar y comparar cotizaciones frente a clausulados. Actualmente, el RAG semántico y el chat de soporte están inoperantes debido a un desajuste técnico: el backend genera embeddings de 768 dimensiones mientras la base de datos Supabase espera 3072. Asimismo, las cotizaciones complejas pierden información crítica al ser extraídas mediante texto plano, los deducibles fallan en formato debido a rigideces de regex, y el chat/validator arroja excepciones por consultas a una vista mal definida (`document_insurer_view`) y una tabla obsoleta en el backend (`clause_documents`).

## Goals / Non-Goals

**Goals:**
- Restaurar la operatividad del RAG semántico alineando los vectores del backend y base de datos a 3072 dimensiones.
- Aumentar la precisión de la extracción de cotizaciones migrando a una ingesta nativa multimodal (PDF) con Gemini 3.5 Flash.
- Corregir de raíz los errores de PostgREST y base de datos reconstruyendo la vista `document_insurer_view` y removiendo llamadas a `clause_documents`.
- Asegurar consistencia y formato estricto en la extracción de deducibles mediante el uso de Gemini Structured Outputs con un esquema tipado.
- Optimizar la precisión de recuperación del chat RAG mediante un umbral calibrado (0.62) y estrategias de re-ranking.

**Non-Goals:**
- Modificar el diseño de la interfaz de usuario en el frontend (React).
- Alterar la lógica comercial de cálculo de comisiones u otras coberturas que no correspondan a los 14 amparos del segmento PYME.
- Implementar soporte para otros proveedores de IA (como OpenAI o Anthropic).

## Decisions

### 1. Cambio de Modelo y Dimensión de Embeddings a 3072
- **Decisión**: Configurar el backend para usar `text-embedding-004` con dimensión estricta de **3072** en lugar del fallback de 768.
- **Razón**: La base de datos Supabase tiene la columna `embedding` tipo `vector(3072)`. Al alinear el backend a 3072 dimensiones se elimina el error de PostgREST por dimensiones dispares, restableciendo las funciones de coincidencia por coseno (`match_chunks_hybrid`, `search_chunks_advanced`).
- **Alternativas**: Modificar la base de datos a `vector(768)` se descartó porque los modelos de embedding modernos de Gemini tienen mayor capacidad de representación y semántica fina a 3072 dimensiones.

### 2. Ingesta PDF Nativa con Gemini File API (Multimodal)
- **Decisión**: Cargar los archivos PDF de cotizaciones directamente en la **Gemini File API** mediante el SDK de `@google/genai` y procesarlos en una sola pasada de visión multimodal con Gemini 3.5 Flash.
- **Razón**: Al procesar el PDF nativo visualmente, el modelo retiene la disposición espacial (tablas, columnas, notas al pie) y no sufre de la distorsión del OCR lineal de `pdfjs-dist`, que mezcla celdas de cotizaciones tabulares.
- **Alternativas**: Seguir con `pdfjs-dist` y tratar de reparar las expresiones de texto plano se descartó por ser costoso y propenso a fallar en cada nueva plantilla de aseguradora.

### 3. Rediseño de la Vista SQL `document_insurer_view`
- **Decisión**: Modificar la base de datos para redefinir la vista `document_insurer_view` mediante un JOIN explícito entre `documents` e `insurers`.
- **Razón**: Resuelve el error `column documents.insurer_name does not exist` al mapear `insurers.name as insurer_name` correctamente en la vista virtual, permitiendo a los validadores y queries del chat operar sin fallas.
- **Detalle de la vista**:
  ```sql
  CREATE OR REPLACE VIEW document_insurer_view AS
  SELECT d.id, d.document_name, d.document_type, d.version, d.total_pages, d.storage_path, d.is_active, d.created_at, i.name as insurer_name, d.insurer_id
  FROM documents d
  JOIN insurers i ON d.insurer_id = i.id;
  ```

### 4. Deducibles Estructurados Nativos con responseSchema
- **Decisión**: Configurar el `deductibleParser.ts` para usar la funcionalidad de **Structured Outputs** de Gemini enviando un JSON Schema tipado en la llamada `extractText` (refactorizada a `extractStructured` o llamada directa con `responseSchema`).
- **Razón**: Gemini garantiza la conformidad del JSON resultante con el esquema, eliminando la inestabilidad de las regex para limpiar respuestas de texto libre de la LLM.
- **Esquema de salida**:
  ```json
  {
    "type": "object",
    "properties": {
      "components": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["percentage", "fixed", "smmlv", "uvt", "minimum", "maximum", "na", "unknown"] },
            "value": { "type": "number" },
            "currency": { "type": "string", "nullable": true }
          },
          "required": ["type", "value"]
        }
      },
      "isZero": { "type": "boolean" },
      "hasMinimum": { "type": "boolean" },
      "hasMaximum": { "type": "boolean" },
      "isComposite": { "type": "boolean" }
    },
    "required": ["components", "isZero", "hasMinimum", "hasMaximum", "isComposite"]
  }
  ```

### 5. Reestructuración del Segmentador Semántico (Semantic Chunker)
- **Decisión**: Incrementar el tamaño del chunk a **2500 - 3000** caracteres con un **15%** de overlap en `semanticChunker.ts`.
- **Razón**: Las cláusulas y exclusiones de seguros en Colombia son extensas. Chunks de 800 caracteres dividen las garantías y exclusiones en múltiples fragmentos, rompiendo su coherencia y dañando la representatividad en el mapa vectorial del RAG.

## Risks / Trade-offs

- **[Riesgo: Límite de cuota (Rate Limit) de la File API]** → **Mitigación**: Implementar un borrado automático estricto de archivos en la Gemini File API dentro del bloque `finally` de `extractFromPdfWithVision` y reutilizar buffers cuando sea viable.
- **[Riesgo: Latencia de procesamiento multimodal]** → **Mitigación**: Utilizar Gemini 3.5 Flash como modelo de extracción, el cual ofrece latencias bajas ($<5$ segundos por página) en comparación con modelos más pesados.
- **[Riesgo: Consumo de Tokens en RAG]** → **Mitigación**: Mantener los filtros de RAG por aseguradora activos para evitar enviar chunks de otras compañías a la ventana de contexto de Gemini.
