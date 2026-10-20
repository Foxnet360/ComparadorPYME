# Design: Ontología Activa con Tri-Banda de Confianza y Micro-Intervenciones UI

## Architecture Overview

```
         [coverageOntology.ts] ──> Tri-banda de Confianza
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
[trusted]     [ambiguous]    [autonomous]
(>= 85%)      (50% - 84%)      (< 50%)
Directo       Needs Review    Independiente
                   │
                   ▼
       [DisambiguationCard.tsx]  (Frontend UI)
                   │  1 clic
                   ▼
  [POST /api/analysis/disambiguate-coverage]
                   │
                   ▼
          [learningEngine.ts]  ──>  Supabase (coverage_mappings) + Redis Cache
```

## Decisions & Rationale

### 1. Tri-Banda Determinística
* **Decisión:** Definir umbrales matemáticos fijos: $\ge 0.85$ para confianza alta, $[0.50, 0.85)$ para ambigüedad, y $< 0.50$ para amparo autónomo.
* **Razón:** Elimina la heurística borrosa y permite que tanto el backend como el frontend compartan la misma semántica de decisión.

### 2. Micro-Interacciones Asíncronas
* **Decisión:** Enviar la confirmación al `learningEngine` en segundo plano sin interrumpir el flujo de lectura del corredor.
* **Razón:** El corredor no debe sentir que está "entrenando un modelo"; solo valida un dato dudoso con un clic y el sistema aprende de forma transparente.

### 3. Capped UI Display
* **Decisión:** Mostrar un máximo de 3 sugerencias de desambiguación por reporte.
* **Razón:** Prevenir la fatiga de alertas (*alert fatigue*) y focalizar la atención del corredor únicamente en coberturas de alto impacto financiero.
