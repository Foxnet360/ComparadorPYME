# RAG Architecture Design

## Context

El proyecto Agente Comparador CSA necesita una arquitectura RAG completa para análisis de seguros. El sistema actual tiene problemas críticos:

- **Extracción PDF**: El código existente usa pdf-parse que no funciona correctamente con PDFs modernos
- **LLM**: Gemini integration está rota y debe reemplazarse
- **Costo**: Sin RAG, se envían documentos completos (50+ páginas) al LLM, generando costos excesivos de tokens
- **Presupuesto**: $20/mes máximo para todo (incluyendo embeddings, vector store, LLM)

**Stakeholders**: Agentes y corredores de seguros PYME que necesitan dictámenes precisos de coberturas.

## Goals / Non-Goals

**Goals:**
- Extraer texto de PDFs de clausulados y cotizaciones de forma confiable
- Implementar chunking semántico que respete la estructura legal de los documentos
- Almacenar embeddings en ChromaDB para retrieval eficiente
- Reemplazar Gemini con Groq (Llama 3.1) para análisis
- Reducir costos de tokens en al menos 60% vs enviar documentos completos
- Mostrar citations exactas (página, sección) en los dictámenes
- Mantener costo total bajo $15/mes

**Non-Goals:**
- OCR para PDFs escaneados (solo PDFs con texto nativo)
- Implementar sistema de autenticación completo
- Migrar datos existentes de IndexedDB a nuevo sistema
- Implementar caching avanzado de embeddings
- Soporte offline completo

## Decisions

### D1: LLM - Groq (Llama 3.1) en lugar de Gemini

**Alternativas evaluadas:**
- Gemini: Costoso, integración rota, no disponible
- Ollama local: Gratis pero requiere servidor con >16GB RAM
- GPT-4o Mini: $0.15/1M tokens, buena calidad
- Claude Haiku: $0.08/1M tokens

**Decisión**: Groq con Llama 3.1 70B

**Rationale**:
- Tier gratuito: 500K tokens/mes (suficiente para desarrollo y uso moderado)
- Latencia extremadamente baja (hardware especializado)
- API simple, más fácil de integrar que Gemini
- Soporta JSON mode para outputs estructurados

### D2: Embeddings - HuggingFace (@xenova/transformers)

**Alternativas evaluadas:**
- OpenAI embeddings ($0.10/1M tokens)
- Cohere (free tier limitado)
- Sentence-transformers local (gratis, requiere RAM)

**Decisión**: HuggingFace Transformers con modelo `sentence-transformers/all-MiniLM-L6-v2`

**Rationale**:
- Completamente gratis
- Modelo ligero (384 dimensiones)
- Suficiente para documents legales en español
- Puede correr local o en servidor sin GPU

### D3: Vector Store - ChromaDB

**Alternativas evaluadas:**
- Pinecone: $25/mes mínimo
- Weaviate: $25/mes
- Qdrant: $12/mes
- PostgreSQL + pgvector: $5/mes (VPS)

**Decisión**: ChromaDB con persistencia local en Railway

**Rationale**:
- ChromaDB tiene tier cloud gratuito (0MB storage)
- Para 750 clausulados (~50 páginas cada uno) ~50MB de texto
- Alternativa: Usar ChromaDB local y backups manuales a S3 si crece
- No requiere costo adicional si保持在 free tier

### D4: Chunking - Regex jerárquico con fallback LLM

**Alternativas evaluadas:**
- Fixed-size chunks (500-1000 tokens): Simple pero rompe cláusulas legales
- Recursive chunking: Más complejo, buen balance
- Agentic chunking (LLM para cada chunk): Caro, preciso

**Decisión**: Regex jerárquico + fallback LLM

**Rationale**:
- Clausulados tienen estructura: CAPÍTULO > SECCIÓN > NUMERAL (ej: 1.1, 1.2)
- Regex puede detectar ~80% de los documentos
- Para documentos sin estructura, usar Groq para identificar secciones
- Mantiene costos bajos (solo LLM para fallback)

**Regex patterns:**
```
CAPÍTULO\\s+[IVXLCDM]+       → Nivel capítulo
SECCIÓN\\s+[IVXLCDM]+        → Nivel sección  
^[0-9]+\\.[0-9]+\\s+         → Nivel numeral
^ARTÍCULO\\s+[0-9]+         → Alternativo
```

### D5: Extracción de texto - pdf-lib

**Alternativas evaluadas:**
- pdf-parse: No funciona correctamente
- pdfjs-dist: Complex, require worker setup

**Decisión**: pdf-lib con extracción de texto página por página

**Rationale**:
- pdf-lib ya está en dependencias del proyecto
- Funciona correctamente con PDFs de texto nativo
- Permite obtener metadata (páginas) para referencias

### D6: Hosting - Railway

**Alternativas evaluadas:**
- Render: Free tier disponible pero cold starts lentos
- DigitalOcean: $4/mes Droplet básico
- Fly.io: $5/mes

**Decisión**: Railway ($5/mes)

**Rationale**:
- Docker support nativo
- Easy scaling
- Integración con GitHub
- $5/mes para el backend es suficiente

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChromaDB cloud free tier tiene límites | Si crece >50MB, toca pagar o migrar | Monitorear uso, migrar a VPS si necesario |
| Groq tier gratuito puede tener rate limits | Interrupciones en alto volumen | Implementar retry con backoff |
| PDFs sin estructura clara | Fallback LLM aumenta costos | Limitar fallback a 3 secciones máximo |
| Embeddings locales consumen RAM | En Railway 1GB RAM puede ser poco | Usar modelo ligero (MiniLM-L6-v2) |
| Cambios frecuentes en clausulados | Index desactualizado | Sistema de re-index manual o automático |

## Migration Plan

### Fase 1: Extracción de texto (Semana 1)
1. Crear servicio `pdfExtractor.ts` con pdf-lib
2. Agregar limpieza de texto (remover headers/footers)
3. Tests con PDFs de ejemplo

### Fase 2: Chunking semántico (Semana 2)
1. Implementar regex parser para estructura
2. Crear fallback con Groq para documentos sin estructura
3. Definir modelo de datos para chunks

### Fase 3: Vector storage (Semana 3)
1. Configurar ChromaDB
2. Implementar servicio de embeddings
3. Crear endpoints para indexar clausulados

### Fase 4: RAG retrieval + Groq analysis (Semana 4)
1. Implementar retrieval por cobertura
2. Configurar Groq client
3. Crear pipeline completo: extract → chunk → embed → retrieve → analyze
4. Actualizar frontend para citations

### Fase 5: Deploy (Semana 5)
1. Configurar Railway con Dockerfile
2. Migrar desde localhost
3. Tests end-to-end

**Rollback**: Mantener código actual en branch `legacy-gemini` por 30 días.

## Open Questions

1. **Q1**: ¿Cuántas versiones de cada clausulado mantener indexadas? (actual + anteriores)
2. **Q2**: ¿Frecuencia de re-indexing? (manual vs automático)
3. **Q3**: ¿Necesitamos cache de resultados por cliente?
4. **Q4**: ¿El frontend actual soporta mostrar citations con referencias?
