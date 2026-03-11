# Context

Los clausulados tienen 50-200 páginas pero solo 3 secciones son críticas para el análisis comparativo.

## Goals / Non-Goals

**Goals:**
- Reducir tokens enviados a Gemini en ~80%
- Identificar secciones automáticamente usando IA
- Mantener contexto suficiente para análisis preciso

**Non-Goals:**
- Extracción perfecta (mejor esfuerzo es aceptable)
- Parsing estructurado de tablas de deducibles

## Decisions

### Decision 1: Usar Gemini para extracción inteligente

Dado que las secciones tienen nombres variables entre aseguradoras:
- "Exclusiones Generales" vs "Riesgos No Cubiertos" vs "No Ampara"
- "Deducibles" vs "Franquicias" vs "Participación del Asegurado"

Usaremos Gemini Flash con prompt específico para identificar y extraer.

### Decision 2: Prompt de extracción

```
Eres un experto en seguros. Del siguiente clausulado, extrae SOLO estas 3 secciones:

1. EXCLUSIONES: Todo lo que el seguro NO cubre
2. DEDUCIBLES: Valores, porcentajes y condiciones de deducibles/franquicias
3. GARANTÍAS: Obligaciones del asegurado para validez del seguro

Responde en JSON:
{
  "exclusiones": "texto...",
  "deducibles": "texto...",
  "garantias": "texto..."
}
```

### Decision 3: Costo de extracción es one-time

El costo de extraer secciones se paga una vez por clausulado. Con ~20 clausulados/aseguradora y cambio anual, esto es negligible comparado al ahorro en análisis.

## Technical Notes

- Usar Gemini 2.0 Flash para extracción (bajo costo)
- Timeout de 60s para clausulados largos
- Si falla extracción, guardar clausulado sin secciones (fallback a texto completo)
