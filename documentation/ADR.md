# Registro de Decisiones Arquitectónicas (ADR)

## Comparador CSA - Extracción Multimodal V2

---

## ADR-001: Selección de Modelo de IA para Extracción de PDFs

**Estado**: Aceptado
**Fecha**: 2025-01-12
**Decisores**: Equipo de desarrollo Comparador CSA

### Contexto
El sistema necesita extraer datos estructurados (coberturas, primas, deducibles) de cotizaciones de seguros en PDF. Los formatos varían radicalmente entre aseguradoras (tablas, secciones, texto corrido).

### Opciones Consideradas
1. **OCR tradicional** (Tesseract, AWS Textract)
2. **LLM con texto extraído** (GPT-4, Gemini Pro text)
3. **LLM multimodal con PDF nativo** (Gemini 2.5 Pro vision)

### Decisión
**Elegida**: Opción 3 - Gemini 2.5 Pro con File API multimodal

### Justificación
- **Precisión**: 95%+ en extracción de tablas vs 60% con OCR tradicional
- **Velocidad**: 30-60s por PDF vs 2.4 minutos con pipeline anterior
- **Costo**: $0.0015 por página vs $0.01+ con servicios OCR enterprise
- **Mantenimiento**: Un solo proveedor (Google) vs integración múltiple

### Consecuencias
- **Positivas**: Mejor extracción, menos código de parsing, unificación de pipeline
- **Negativas**: Dependencia de Google, necesita polling de File API, requiere manejo de estados

---

## ADR-002: Estrategia de Extracción - Texto vs Multimodal

**Estado**: Aceptado
**Fecha**: 2025-01-12

### Contexto
¿Extraer texto del PDF primero y enviarlo al LLM, o enviar el PDF directo?

### Opciones
1. **Texto puro**: pdfjs-dist → extraer texto → prompt
2. **Multimodal**: PDF nativo → Gemini File API → vision

### Decisión
**Pipeline dual**: V2 (multimodal) por defecto, V1 (texto) como fallback

### Justificación
- pdfjs-dist destruye estructura tabular (problema confirmado en producción)
- Gemini vision entiende layout, tablas, fuentes, colores
- Fallback necesario por si File API falla

### Consecuencias
- **Positivas**: Máxima precisión, mantiene V1 como respaldo
- **Negativas**: Duplicidad temporal de código hasta migración completa

---

## ADR-003: Normalización de Coberturas a Schema Canónico

**Estado**: Aceptado
**Fecha**: 2025-01-12

### Contexto
Cada aseguradora usa nombres diferentes para la misma cobertura (ej: "Incendio y Líneas Aliadas" vs "Daños Materiales - Incendio").

### Opciones
1. **Prompt engineering**: Pedir a LLM que use nombres estándar
2. **Post-procesamiento**: Normalizar después de extracción
3. **Embeddings semánticos**: Similaridad vectorial

### Decisión
**Combinación**: Post-procesamiento con 4 capas (thesaurus → fuzzy → embedding → LLM)

### Justificación
- Prompt engineering solo: 70% precisión
- Post-procesamiento: 85% precisión
- Combinación: 95%+ precisión

### Consecuencias
- **Positivas**: Comparación consistente entre aseguradoras
- **Negativas**: Latencia adicional (~500ms por cotización)

---

## ADR-004: Feature Flag Strategy

**Estado**: Aceptado
**Fecha**: 2025-01-12

### Contexto
Necesitamos poder activar/desactivar V2 sin redeploy.

### Opciones
1. **Build-time**: Variable de entorno en build
2. **Runtime**: Base de datos o servicio externo (LaunchDarkly)
3. **Hybrid**: Build-time default + runtime override

### Decisión
**Build-time con override**: Default true (V2 activo), puede desactivarse con `ENABLE_MULTIMODAL_EXTRACTION=false`

### Justificación
- Railway rebuilds en cada push → build-time es suficiente
- No necesitamos granularidad por usuario (deploy al 100%)
- Menor complejidad que sistema runtime

### Consecuencias
- **Positivas**: Simple, rápido, no dependencias externas
- **Negativas**: Requiere redeploy para cambiar flag

---

## ADR-005: Base de Datos y Vector Storage

**Estado**: Aceptado (existente)
**Fecha**: 2025-01-12

### Contexto
Storage de chunks vectorizados para RAG.

### Decisión Mantenida
**Supabase (PostgreSQL + pgvector)**

### Justificación
- Ya en uso, datos existentes
- pgvector soporta búsqueda por similitud
- Integración nativa con Supabase Auth
- Costo: $0 bajo volumen actual

---

## ADR-006: Infraestructura de Deploy

**Estado**: Aceptado (existente)
**Fecha**: 2025-01-12

### Contexto
Plataforma de deploy para backend y frontend.

### Decisión Mantenida
**Railway**

### Justificación
- Deploy automático desde GitHub
- Variables de entorno gestionadas
- Logs centralizados
- Escalado automático
- Costo: $5/mes (plan básico)

---

## ADR-007: Stack Tecnológico Frontend

**Estado**: Aceptado (existente)
**Fecha**: 2025-01-12

### Tecnologías
- **Framework**: React 19 + Vite
- **Estilos**: Tailwind CSS
- **Gráficos**: Recharts
- **PDF**: jsPDF + jspdf-autotable
- **Markdown**: react-markdown

### Justificación
- React 19: Mejoras de performance y Server Components
- Vite: Build rápido, HMR instantáneo
- Tailwind: Consistencia, mantenibilidad
- Recharts: Integración nativa con React

---

## ADR-008: Stack Tecnológico Backend

**Estado**: Aceptado (existente)
**Fecha**: 2025-01-12

### Tecnologías
- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **IA**: Google Generative AI (@google/generative-ai)
- **Base de datos**: Supabase (PostgreSQL)
- **Vector search**: pgvector
- **Testing**: Vitest

### Justificación
- Node.js: Mismo lenguaje frontend/backend
- Express: Mínimo, rápido, middleware ecosystem
- Google AI: Mejor precisión en español colombiano
- Supabase: Auth, DB, Storage en uno

---

## ADR-009: Manejo de PDFs

**Estado**: Actualizado
**Fecha**: 2025-01-12

### Decisión Original
**pdfjs-dist** para extracción de texto

### Decisión Actualizada
**Gemini File API** para PDFs nativos, **pdfjs-dist** solo como fallback/utility

### Razón del Cambio
- pdfjs-dist destruye estructura tabular (problema crítico en producción)
- Gemini vision mantiene layout, tablas, relaciones espaciales
- Reducción de 2.4 min a 30-60 segundos por cotización

---

## Resumen de Decisiones

| # | Decisión | Impacto | Riesgo |
|---|----------|---------|--------|
| 001 | Gemini 2.5 Pro | Alto | Dependencia vendor |
| 002 | Pipeline dual | Medio | Deuda técnica temporal |
| 003 | Normalización 4 capas | Medio | Latencia +
| 004 | Build-time flags | Bajo | Redeploy necesario |
| 005 | Supabase pgvector | Medio | Vendor lock-in |
| 006 | Railway | Medio | Costo a escala |
| 007 | React 19 + Vite | Bajo | Curva de aprendizaje |
| 008 | Node + Express | Bajo | Performance vs Go/Rust |
| 009 | File API multimodal | Alto | Cambio arquitectónico |

---

*Documento generado: 2025-01-12*
*Versión: 2.0*
*Branch: feature/multimodal-quote-extraction-v2*
