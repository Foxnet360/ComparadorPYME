## Context

El sistema actual intenta analizar cotizaciones de seguros en una sola llamada a Gemini, forzando un schema JSON complejo con 14 coberturas, scoring, alerts, y análisis narrativo. Cuando se procesan 3-5 cotizaciones, el output requerido excede el límite de tokens de salida (8192 para gemini-2.5-flash), causando JSON truncado e inválido.

La lógica de negocio actual separa cotizaciones de clausulados:
- **Cotizaciones**: Documentos con precios, coberturas, deducibles
- **Clausulados**: Documentos legales con términos y condiciones (se procesarán en un change futuro)

## Goals / Non-Goals

**Goals:**
- Procesar 3-5 cotizaciones simultáneamente sin truncamiento
- Dividir el análisis en 3 fases atómicas e independientes
- Implementar pre-cálculo de tokens para prevenir envíos inválidos
- Mantener la API existente (`/api/analyze`) sin cambios de contrato

**Non-Goals:**
- Procesar clausulados (diferente change)
- Cambiar la UI del frontend
- Soportar más de 5 cotizaciones por análisis
- Usar modelos diferentes de Gemini (trabajamos con lo disponible)

## Decisions

### 1. Arquitectura de 3 Fases

```
Fase 1: EXTRACCIÓN
Input: Textos de 3-5 cotizaciones
Output: Array de objetos planos { insurerName, policyName, priceAnnual, coverages: [] }
Token estimate: ~500-1000 output tokens

Fase 2: SCORING  
Input: Resultado Fase 1
Output: { quotes: [{ score, scoringBreakdown, alerts[] }] }
Token estimate: ~1000-2000 output tokens

Fase 3: NARRATIVA
Input: Resultado Fase 1 + Fase 2
Output: { recommendation, marketAnalysis }
Token estimate: ~500-1000 output tokens
```

**Rationale**: Cada fase tiene un output acotado que cabe cómodamente en 8192 tokens. Si una fase falla, las otras pueden continuar o reintentar independientemente.

### 2. Schema Simplificado por Fase

**Fase 1 (Extracción)**:
```json
{
  "quotes": [{
    "insurerName": "string",
    "policyName": "string", 
    "priceAnnual": "number",
    "currency": "string",
    "coverages": [{"name": "string", "value": "string", "deductible": "string"}]
  }]
}
```

**Fase 2 (Scoring)**:
```json
{
  "quotes": [{
    "insurerName": "string",
    "score": "number",
    "scoringBreakdown": {"coverage": "number", "deductibles": "number", "exclusions": "number", "priceRatio": "number", "sublimits": "number", "warranties": "number"},
    "alerts": [{"level": "string", "title": "string", "description": "string"}]
  }]
}
```

**Fase 3 (Narrativa)**:
```json
{
  "recommendation": "string",
  "marketAnalysis": "string"
}
```

### 3. Token Counting Preventivo

Usar `model.countTokens()` antes de cada llamada. Si el input excede el 80% de la ventana de contexto, dividir las cotizaciones en lotes más pequeños.

### 4. Fallback Individual

Si el análisis batch de N cotizaciones falla, reintentar de a 2 cotizaciones por vez y mergear los resultados.

## Risks / Trade-offs

- **[Risk] Mayor latencia total**: 3 llamadas seriales = ~3-6s adicionales
  - **Mitigation**: Agregar progreso visible al usuario ("Fase 1/3: Extrayendo datos...")
  
- **[Risk] Inconsistencia entre fases**: Fase 2 podría scoring inconsistente si Fase 1 omitió datos
  - **Mitigation**: Validación estricta de output de Fase 1 antes de pasar a Fase 2

- **[Risk] Costo de API**: 3 llamadas = 3x costo de tokens de input
  - **Mitigation**: Los inputs son pequeños comparados con el output, el costo incremental es mínimo

## Migration Plan

1. Crear servicios `quoteExtractor.ts`, `quoteScorer.ts`, `quoteNarrative.ts`
2. Modificar `analysisController.ts` para usar la pipeline de 3 fases
3. Agregar logging de progreso por fase
4. Mantener `gemini.ts` existente como fallback
5. Probar con 3-5 cotizaciones reales