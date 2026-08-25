# Proposal: Tubería de Análisis Multimodal Holístico (Zero-Chunking, Citas de Evidencia y Auditoría en 2 Pasos)

## Intent
Superar las limitaciones del análisis tradicional mediante una tubería nativa **Multimodal Holística (Zero-Chunking)**. En lugar de fraccionar los PDFs de las cotizaciones en bloques de texto plano, la nueva tubería ingiere los documentos de forma completa y visual en el espacio nativo de Gemini 2.5/3.5 Vision, garantizando precisión absoluta en la extracción de coberturas, sublmites y deducibles complejos, respaldados por **citas de página y evidencia textual**, e inspeccionados por un **pase de auditoría de consistencia en 2 pasos**.

## Scope

### 1. Ingesta Nativa Multimodal Holística (Zero-Chunking)
- Eliminar el fraccionamiento (chunking) y la conversión a texto plano lineal en el flujo de cotizaciones.
- Enviar las páginas completas en alta resolución (PDF nativo / visión multimodal) a Gemini 2.5/3.5 Flash en una sola ventana de contexto holística por cotización.

### 2. Sistema de Citas y Evidencia de Origen (Grounding & Citation)
- Extender el esquema de respuesta para que cada celda de cobertura, límite y deducible incluya:
  - `pageNumber`: Número de página exacto de la póliza donde figura la condición.
  - `sourceSnippet`: Cita textual literal extraída del documento original.
  - `confidenceScore`: Índice de certeza de extracción (0 a 100%).

### 3. Esquema Híbrido Canónico + Atributos Dinámicos
- Evitar pérdidas por rigidez de esquema:
  - **Matriz Canónica:** Amparos universales del ramo seleccionado.
  - **Payload Dinámico de Matices:** Cláusulas particulares, sublímites específicos y garantías únicas de cada aseguradora renderizados sin omisiones.

### 4. Arquitectura en 2 Pasos con Autocorregido (Two-Pass Verification)
- **Pase 1 (Extracción & Alineación):** Extracción nativa estructurada por aseguradora.
- **Pase 2 (Auditoría & Reconciliación):** Invocación de validación cruzada que audita la matriz generada contra las imágenes originales del PDF, corrigiendo deducibles omitidos o montos truncados antes de emitir la respuesta final.

## Success Criteria
- Extracción precisa de deducibles y sublímite sin truncamiento por separadores numéricos.
- Cada celda de la tabla de comparación incluye el número de página y la cita de evidencia del PDF.
- 0% de pérdidas de contexto por corte de páginas o tablas divididas.
- Tasa de coincidencia y confiabilidad superior al análisis manual o chats genéricos.
