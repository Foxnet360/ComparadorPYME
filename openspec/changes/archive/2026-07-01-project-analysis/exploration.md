## Exploration: Project Analysis

### Current State
El sistema está construido como una aplicación web de pila completa (Full-stack) utilizando **TypeScript**, **React 19** (con **Vite 8** y **Tailwind CSS**) en el frontend, y **Express 5** en el backend (Node.js). La persistencia de datos se gestiona con **Supabase (PostgreSQL)** y la caché con **Redis**. La inteligencia artificial y procesamiento de lenguaje natural son motorizados por **Google Gemini API** y **Groq**.

La arquitectura actual implementa un modelo de **Ontología Fluida** para la comparación de seguros PYME en el mercado colombiano, superando el modelo anterior de categorías fijas. Las áreas y sus componentes clave se organizan de la siguiente manera:

1. **Frontend (`/components`, `/services`, `/contexts`, `/hooks`)**
   - Interfaz interactiva de comparación como `UnifiedCoverageMatrix.tsx` y `ComparisonReport.tsx`.
   - Componentes de administración y auditoría (`AuditDashboard.tsx`, `CuratorDashboard.tsx`).
   - Chat interactivo integrado (`ChatBot.tsx`) que consume la API del servidor.

2. **Backend (`/server/src`)**
   - **Rutas y Controladores (`/routes`, `/controllers`)**: Puntos de entrada HTTP definidos en `/routes/` (e.g., `chat.ts`, `analysis.ts`, `comparisonRoutes.ts`) y resueltos en controladores.
   - **Esquemas (`/schemas`, `/server/src/schemas`)**: Validaciones de datos y de salida estructurada para modelos LLM usando Zod/JSON Schema (e.g., `extractionSchemas.ts`).
   - **Servicios (`/server/src/services`)**: Lógica central de la ontología semántica:
     - `structuredClauseExtractor.ts`: Extracción JSON estructurada de pólizas/clausulados en una pasada.
     - `coverageOntology.ts`: Agrupamiento semántico probabilístico de coberturas.
     - `deductibleParser.ts` & `hybridDeductibleParser.ts`: Procesamiento semántico de deducibles compuestos.
     - `chatService.ts`: Chat con triple fuente de verdad priorizada (cotizaciones > clausulados > base de conocimiento).
     - `ragRetrievalService.ts` & `queryExpander.ts`: Recuperación híbrida (Vectores + BM25) optimizada por expansión semántica.
     - `learningEngine.ts`: Motor de aprendizaje continuo a partir de correcciones manuales hechas por usuarios.

3. **Base de Datos (`/server/migrations`, `/supabase`)**
   - Tablas de Supabase de gran importancia como `structured_clauses` (datos extraídos en formato JSONB) y `coverage_mappings` (mapeos e historiales de corrección).
   - Funciones RPC de PostgreSQL en `/server/migrations` para la búsqueda híbrida y mapeo rápido.

### Affected Areas
- `package.json` — Define las dependencias compartidas de frontend y backend del proyecto.
- `server/src/index.ts` — Inicialización y enrutamiento principal de la API del backend.
- `server/src/services/` — Directorio con la lógica de negocio central del sistema de ontología fluida.
- `components/` — Componentes de React en el frontend para visualización y dashboards.
- `openspec/config.yaml` — Configuración de los estándares de desarrollo Spec-Driven (SDD) del repositorio.

### Approaches
1. **Ontología Fluida (Enfoque Actual)** — Mantenimiento del modelo probabilístico dinámico mediante embeddings y Gemini.
   - Pros: Preserva la verdad del documento original sin forzar a una taxonomía estricta, reduce errores de RAG y asiste con alta precisión.
   - Cons: Mayor dependencia de APIs externas (Gemini) y mayor procesamiento computacional de normalización.
   - Effort: Low (Ya implementado y en funcionamiento).

2. **Esquema de Categorización Estricta (Legacy)** — Retorno al modelo clásico de categorías rígidas predefinidas (14 categorías fijas).
   - Pros: Menor complejidad en el backend y lógica de base de datos relacional simplificada.
   - Cons: Pérdida importante de matices y coberturas especializadas, y mayor índice de corrección manual requerida.
   - Effort: High (Requeriría reescribir y simplificar críticamente múltiples servicios del backend).

### Recommendation
Se recomienda continuar con el **Enfoque de Ontología Fluida (Actual)**. La estructura actual de servicios (`server/src/services/`) está fuertemente desacoplada y diseñada para escalar modularmente. El sistema permite extender el motor de aprendizaje (`learningEngine.ts`) y la calibración de deducibles sin afectar la estabilidad general.

### Risks
- **Costo y Latencia de LLM**: Dependencia crítica del rendimiento y tiempos de respuesta de la API de Google Gemini para la extracción y el chat interactivo.
- **Sincronización de Caché**: La velocidad de consultas híbridas depende de un correcto funcionamiento y coherencia entre Redis y la base de datos de Supabase.

### Ready for Proposal
Yes — El análisis de estructura y arquitectura está completo. El orquestador puede informar al usuario que la base del proyecto está mapeada correctamente y que se puede proceder con propuestas específicas de cambio o nuevas implementaciones utilizando el flujo de OpenSpec.
