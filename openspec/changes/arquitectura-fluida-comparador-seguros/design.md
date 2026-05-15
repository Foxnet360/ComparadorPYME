## Context

El comparador de cotizaciones de seguros PYME actual sufre de arquitectura rígida que fuerza datos heterogéneos en estructuras estáticas. El sistema actual:

- Indexa clausulados como chunks de texto de 800 caracteres, perdiendo la estructura legal (relaciones cobertura→deducible→exclusión)
- Fuerza 14 categorías canónicas fijas sobre productos de seguros que son inherentemente diferentes (ej: "AMPARO BASICO" de MAPFRE es "Todo Riesgo" compuesto, no solo "Incendio")
- Parsea deducibles con regex simple que no entiende estructuras compuestas como "10% con mínimo de 5 SMMLV y tope de 50 SMMLV"
- El chat depende 100% de RAG que falla frecuentemente (0 chunks recuperados), resultando en "no tengo información" cuando sí hay datos en la cotización

Estos problemas causan que el 70% de los análisis requieran corrección manual y el sistema no genere valor para corredores de seguros.

## Goals / Non-Goals

**Goals:**
- Implementar extracción estructurada de clausulados a JSON preservando relaciones legales
- Crear ontología fluida de coberturas con grupos semánticos dinámicos y mapeo probabilístico
- Comparar cotizaciones variable a variable sin forzar categorías canónicas
- Implementar parser semántico de deducibles que entienda estructuras compuestas
- Rediseñar chat con triple fuente de verdad (cotización + clausulado + conocimiento general)
- Agregar sistema de aprendizaje continuo basado en correcciones del usuario
- Mejorar RAG con query expansion, parent-child retrieval y re-ranking

**Non-Goals:**
- No se reemplaza la extracción multimodal de PDFs (se mantiene Gemini 2.5 Pro)
- No se cambia de Supabase a otra base de datos
- No se implementa procesamiento de imágenes u OCR
- No se crea interfaz de usuario nueva (solo mejoras al reporte existente)

## Decisions

### Decision 1: Extraer clausulados a JSON estructurado en una sola pasada con LLM
**Rationale:** Extraer el clausulado completo como JSON preserva las relaciones legales (cobertura→deducible→exclusión) que se pierden con chunking. Una sola llamada a LLM por documento es más eficiente que múltiples búsquedas RAG.

**Alternatives considered:**
- Mejorar chunking semántico (rechazado: sigue perdiendo estructura)
- Usar GraphQL para relaciones (rechazado: overkill para este caso)
- Mantener chunks + crear índice separado (rechazado: duplicación de datos)

**Trade-offs:**
- +100% de precisión en recuperación de información específica
- +200ms de procesamiento inicial por documento
- Requiere validación del JSON extraído

### Decision 2: Reemplazar 14 categorías con ontología fluida de 3 niveles
**Rationale:** Las 14 categorías canónicas fuerzan peras con manzanas. Una ontología fluida permite representar que "AMPARO BASICO" es 85% "Edificios" y 60% "Equipos" simultáneamente.

**Structure:**
```
Nivel 1 (Familias): Patrimoniales | Responsabilidad Civil | Asistencias | Riesgos Especiales
Nivel 2 (Sub-familias): Edificios | Equipos | Interrupción de Negocio | ...
Nivel 3 (Variantes): "AMPARO BASICO" (MAPFRE) | "TODO RIESGO" (BBVA) | ...
```

**Alternatives considered:**
- Expandir a 20+ categorías (rechazado: sigue siendo rígido)
- Usar solo embeddings sin jerarquía (rechazado: difícil de visualizar)
- Tags libres (rechazado: difícil de comparar)

### Decision 3: Comparar variables directamente en lugar de categorías
**Rationale:** Es más útil decir "MAPFRE cubre $500M con deducible 10%, CHUBB cubre $450M con deducible 10%+mínimo" que "Ambos tienen Incendio".

**Variables comparables:**
- Valor asegurado (normalizado a COP)
- Deducible (estructura compuesta normalizada)
- Sublímite (monto o porcentaje)
- Exclusiones (lista normalizada)
- Condiciones especiales (lista)

### Decision 4: Implementar parser semántico de deducibles con LLM + validación
**Rationale:** Los deducibles colombianos tienen formatos muy variables. Un LLM con prompt especializado entiende "sin aplicación de deducible" o "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" mejor que regex.

**Estrategia:**
- Regex rápido para casos simples (<20 chars, patrones obvios)
- LLM (Gemini Flash) para casos complejos
- Validación: mínimo < máximo, porcentaje entre 0-100%

### Decision 5: Triple fuente de verdad para chat con prioridad estricta
**Rationale:** El chat actual falla porque depende solo de RAG. Los datos de cotización están siempre disponibles y son extraídos del PDF.

**Prioridad:**
1. Datos de cotización (siempre disponible, extraído del PDF)
2. Clausulados estructurados (si existe en DB)
3. Conocimiento general del LLM (último recurso, con disclaimer)

**Regla de oro:** Nunca decir "no tengo información" si los datos están en la cotización.

### Decision 6: Usar Gemini 2.5 Flash para extracción estructurada
**Rationale:** Flash es 10x más barato que Pro y suficiente para extracción JSON estructurada. Pro se reserva para extracción multimodal inicial del PDF.

**Costo estimado:**
- Extracción de cotización (Pro multimodal): ~$0.05 por PDF
- Extracción de clausulado (Flash estructurado): ~$0.02 por documento
- Chat (Flash): ~$0.001 por mensaje

### Decision 7: Query expansion con tesauro en lugar de fine-tuning de embeddings
**Rationale:** Fine-tuning de embeddings requiere dataset de entrenamiento que no tenemos. Query expansion con tesauro existente mejora recuperación inmediatamente.

**Implementación:**
```typescript
expandQuery("deducible incendio") → [
  "deducible incendio",
  "franquicia amparo básico",
  "participación daño material"
]
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM extrae estructura JSON incorrecta | Alto | Validación contra texto raw + esquema JSON estricto + reintentos |
| Usuarios confunden ontología fluida con categorías fijas | Medio | Interfaz muestra confianza (%) y permite ver mapeos alternativos |
| Performance lento con muchas cotizaciones | Medio | Cache de embeddings + procesamiento async + Redis |
| Costo de LLM se dispara | Medio | Rate limiting + cache + modelos más pequeños para tareas simples |
| Datos estructurados ocupan más espacio | Bajo | JSONB comprimido + índices selectivos |
| Migración de datos existentes | Medio | Script de migración que extrae estructura de chunks existentes |

## Migration Plan

### Fase 1: Preparación (Semana 1)
1. Crear tablas nuevas (`structured_clauses`, `coverage_mappings`)
2. Agregar índices GIN
3. Implementar servicios nuevos en paralelo (no reemplazar existentes todavía)

### Fase 2: Extracción estructurada (Semana 2)
1. Procesar clausulados existentes con nuevo extractor
2. Poblar `structured_clauses`
3. Validar extracciones contra texto original

### Fase 3: Activación gradual (Semana 3)
1. Activar nueva arquitectura para nuevos análisis
2. Mantener sistema antiguo como fallback
3. Comparar resultados entre sistemas

### Fase 4: Deprecación (Semana 4+)
1. Una vez validado >85% de precisión, desactivar sistema antiguo
2. Eliminar código legacy

### Rollback Strategy
- Feature flag para activar/desactivar nueva arquitectura
- Sistema antiguo funciona en paralelo durante migración
- Script para re-convertir datos estructurados a chunks si es necesario

## Open Questions

1. **¿Fine-tuning de embeddings?** Evaluar si query expansion es suficiente o si necesitamos fine-tuning con corpus de seguros colombianos.

2. **¿Re-ranking local vs API?** Decidir entre usar cross-encoder local (ms-marco-MiniLM, sin costo) o API (Cohere, con costo pero mejor calidad).

3. **¿Nivel de granularidad de la ontología?** Determinar si 3 niveles son suficientes o si necesitamos más jerarquía para ciertos tipos de seguros.

4. **¿Benchmarks de mercado?** Definir fuente de truth para benchmarks de deducibles (datos históricos, input de corredores, etc.)
