## Context

El sistema actual genera alertas durante el análisis de cotizaciones pero estas carecen de:
1. Fundamentación documental (cláusulas específicas)
2. Contexto de negocio
3. Comparativa cruzada

La base de datos Supabase ya tiene:
- Tabla `clause_chunks` con embeddings (3072 dims)
- Funciones RPC: `match_clauses`, `match_clauses_vector`, `get_clauses_by_coverage`
- RAG retrieval service funcional

## Goals / Non-Goals

**Goals:**
- Enriquecer alertas con evidencia de clausulados vía RAG
- Dashboard ejecutivo de riesgos
- Análisis contextual del negocio
- Toggle automático: enriquecido (con clausulados) vs básico (sin clausulados)

**Non-Goals:**
- No modificar la generación de alertas (sigue siendo Gemini)
- No crear nueva base de datos (usa Supabase existente)
- No modificar el flujo de análisis principal

## Decisions

### 1. Enriquecimiento bajo demanda (botón)
**Decisión:** Botón "Enriquecer con Clausulados" en vez de automático
**Rationale:** 
- Reduce latencia inicial del reporte
- Solo carga cuando el usuario lo solicita
- Permite fallback graceful si falla RAG

### 2. Dos modos de enriquecimiento
**Decisión:** 
- **Modo Enriquecido** (cuando hay clausulados indexados): Usa RAG + evidence cards
- **Modo Básico** (cuando no hay clausulados): Análisis técnico basado en datos extraídos + patrones de mercado

**Rationale:** Siempre hay valor, independientemente de si hay clausulados

### 3. Modelo de IA para contexto
**Decisión:** No usar IA adicional para el enriquecimiento
**Rationale:** 
- El enriquecimiento es puramente RAG (búsqueda vectorial) + reglas de negocio
- No se necesita LLM adicional, lo que reduce costos
- La IA ya generó las alertas; el enriquecimiento es "evidencia"

## Risks / Trade-offs

**Riesgo:** Latencia al hacer clic en "Enriquecer" (búsqueda RAG puede tardar 2-5s)
**Mitigación:** Mostrar spinner, cachear resultados en sessionStorage

**Riesgo:** No hay clausulados indexados para alguna aseguradora
**Mitigación:** Modo básico automático con análisis técnico profesional

**Riesgo:** Embeddings inconsistentes (cotización vs clausulado)
**Mitigación:** Usar mismo modelo de embedding (Gemini embedding-001)

## Migration Plan

1. Crear servicio de enriquecimiento
2. Crear endpoint API
3. Rediseñar AuditSection
4. Testing con datos reales

## Open Questions

1. ¿Qué tan detallado debe ser el análisis contextual del negocio?
2. ¿Debe permitirse exportar el dashboard de riesgos a PDF?
