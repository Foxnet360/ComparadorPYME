# Design: unified-multimodal-comparison-engine

## Context

El sistema actual procesa cotizaciones de seguros mediante un pipeline fragmentado:
1. **Extracción individual**: Cada PDF se procesa separadamente (4 llamadas a Gemini para 4 aseguradoras)
2. **Normalización**: Los datos extraídos se normalizan a 14 categorías canónicas usando embeddings y fuzzy matching
3. **Comparación programática**: El sistema compara los datos normalizados celda por celda
4. **RAG para clausulados**: Se indexan clausulados en vectores para consultas posteriores

Este pipeline ha generado más de 10 cambios archivados intentando arreglarlo. Los problemas persistentes son:
- Deducibles se extraen como strings sin estructura ("10% PERD - Min 1 SMMLV")
- La normalización pierde equivalencias semánticas ("Amparo Básico" vs "Sección Primera")
- El chat no encuentra información relevante a pesar de tener datos
- Tiempo de procesamiento: ~270 segundos

Un experimento con prompt simple demostró que un LLM multimodal puede generar una comparativa completa y precisa en una sola pasada, entendiendo equivalencias semánticas sin necesidad de normalización manual.

## Goals / Non-Goals

**Goals:**
* **Motor unificado**: Procesar N cotizaciones en una sola llamada LLM multimodal
* **JSON comparativo**: Generar estructura que replique exactamente el Excel técnico de referencia
* **Coexistencia segura**: Operar en paralelo con el sistema actual mediante feature flags
* **Adaptación transparente**: El nuevo motor debe producir `MatrixRow[]` compatible con la UI y Excel existentes
* **Modo profundo**: Validar deducibles ambiguos contra clausulados cuando estén disponibles

**Non-Goals:**
* No modificar `matrixTransformer.ts`, `excelGenerator.ts`, ni `UnifiedCoverageMatrix.tsx`
* No reemplazar el sistema de chat/RAG existente (fase futura)
* No modificar el esquema de base de datos de Supabase
* No reentrenar embeddings ni modificar la ontología existente
* No eliminar el motor legacy (coexistencia, no reemplazo)

## Decisions

### Decision 1: Arquitectura de Coexistencia con Feature Flags
**Decisión**: Implementar un adapter pattern que permita seleccionar entre motor legacy y motor unificado mediante feature flag.

```typescript
// Adapter que selecciona motor según feature flag
export async function generateComparison(pdfPaths: string[]): Promise<MatrixRow[]> {
  if (featureFlags.isEnabled('useUnifiedComparisonEngine')) {
    try {
      const result = await unifiedComparisonEngine.compare(pdfPaths);
      return adapter.toMatrixRows(result);
    } catch (error) {
      logger.warn('Unified engine failed, falling back to legacy', error);
      return legacyComparisonService.compare(pdfPaths);
    }
  }
  return legacyComparisonService.compare(pdfPaths);
}
```

**Razón**: 
- Permite rollout gradual sin riesgo de regresión
- Si el nuevo motor falla, los usuarios no se ven afectados
- Facilita A/B testing entre motores
- No requiere modificar la UI ni el exportador Excel

**Alternativa considerada**: Reemplazo directo del motor legacy. *Rechazada*: Demasiado riesgoso para producción sin validación extensiva.

### Decision 2: Prompt Único Multimodal con Múltiples PDFs
**Decisión**: Procesar todos los PDFs de cotización en una sola llamada a Gemini 3.5 Flash.

**Configuración recomendada**:
```typescript
const config = {
  model: 'gemini-3.5-flash',
  thinkingConfig: {
    thinkingLevel: 'MEDIUM' // Default, balance calidad/velocidad
  },
  // NO usar temperature, top_p, top_k (no recomendado en Gemini 3.x)
  responseMimeType: 'application/json',
  responseSchema: comparisonOutputSchema, // JSON Schema estricto
};
```

**Razón**:
- El LLM entiende equivalencias semánticas sin normalización manual
- Detecta inconsistencias cruzadas (ej: CHUBB $45M vs otros $119.6M)
- Reduce de 4+ llamadas a 1 llamada (mejor latencia total)
- Mejores prácticas oficiales: sin temperature/top_p/top_k

**Alternativa considerada**: Mantener extracción individual y agregar paso de comparación. *Rechazada*: No resuelve el problema fundamental de pérdida de contexto.

### Decision 3: JSON Schema Basado en Excel de Referencia
**Decisión**: El output del LLM sigue estrictamente una estructura que replica las 3 hojas del Excel técnico.

```typescript
interface UnifiedComparisonResult {
  metadata: {
    generatedAt: string;
    model: string;
    thinkingLevel: string;
    pdfCount: number;
    confidence: number; // 0-1, para decidir si requiere revisión humana
  };
  client: { name, activity, address, city, totalInsuredValue };
  insurers: Array<{ name, quoteDate, validity, product }>;
  coverageMatrix: Array<{
    category: string;
    isExclusive?: boolean;
    rows: Array<{
      type: 'value' | 'deductible' | 'includes' | 'exclusions';
      label: string;
      cells: Array<{
        value: string | null;
        rawText?: string;
        confidence?: number;
        pageNumber?: number;
        isAmbiguous?: boolean;
      }>;
    }>;
  }>;
  financials: {
    premiums: Array<{ insurer, netPremium, fees, taxes, total, percentageOfValue }>;
    metadata: Array<{ insurer, commission, backing, modality }>;
  };
  analysis: {
    bestValue?: string;
    warnings: string[];
    significantDifferences: Array<{ coverage, difference, severity }>;
  };
}
```

**Razón**:
- Paridad exacta con el Excel de referencia
- Compatible con el transformador `MatrixRow[]` existente
- Incluye metadata de confianza para auditoría humana

### Decision 4: Modo Profundo como Segunda Pasada Opcional
**Decisión**: Los clausulados se procesan en una segunda pasada, no en la primera.

```typescript
// Paso 1: Comparación con solo cotizaciones
const comparison = await unifiedComparisonEngine.compare(quotes);

// Paso 2 (opcional): Validar con clausulados
if (clauseFiles.length > 0) {
  const validated = await unifiedComparisonEngine.validateWithClauses(
    comparison, 
    clauseFiles
  );
}
```

**Razón**:
- La comparación básica es rápida (30-60s)
- Los clausulados pueden añadirse posteriormente sin reprocesar todo
- Reduce costo cuando no hay clausulados disponibles
- Permite al usuario decidir cuándo profundizar

**Alternativa considerada**: Procesar todo junto en una llamada. *Rechazada*: Más tokens, más lento, y no siempre hay clausulados.

### Decision 5: Validación Automática del JSON de Salida
**Decisión**: Implementar validación estructural del output del LLM antes de usarlo.

```typescript
export async function validateComparisonResult(
  result: any
): Promise<ValidationResult> {
  const schemaValidation = validateAgainstSchema(result, comparisonSchema);
  const businessValidation = validateBusinessRules(result);
  
  return {
    isValid: schemaValidation.valid && businessValidation.valid,
    schemaErrors: schemaValidation.errors,
    businessWarnings: businessValidation.warnings,
    confidence: calculateConfidence(result),
    needsHumanReview: confidence < 0.90
  };
}
```

**Razón**:
- Detecta alucinaciones del modelo antes de mostrar al usuario
- Calcula confianza para decidir si requiere revisión humana
- Previene datos corruptos en la base de datos

## Risks / Trade-offs

* **[Riesgo] Costo de tokens con múltiples PDFs**: Procesar 8+ PDFs puede consumir muchos tokens
  * *Mitigación*: Gemini 3.5 Flash tiene 1M contexto. 8 PDFs de 5 páginas ≈ 50K tokens, muy manejable.

* **[Riesgo] Latencia con cotizaciones complejas**: 8+ aseguradoras pueden tardar >60 segundos
  * *Mitigación*: Implementar streaming de progreso (Server-Sent Events). Mostrar estado al usuario.

* **[Riesgo] Hallucinations en datos numéricos**: El LLM podría inventar valores o primas
  * *Mitigación*: Validación estructural + reglas de negocio + flag `needsHumanReview` cuando confianza < 0.90

* **[Riesgo] Diferencias de formato entre aseguradoras**: Nueva aseguradora con formato inesperado
  * *Mitigación*: El prompt es genérico ("extrae lo que veas"), no depende de templates específicos.

* **[Riesgo] Fallback al legacy genera inconsistencia**: Si el nuevo motor falla, el usuario ve resultados del legacy
  * *Mitigación*: Logging detallado para identificar cuándo ocurre. Métricas para decidir cuándo activar permanentemente.

## Migration Plan

### Fase 1: Implementación (Semana 1-2)
1. Crear servicios del motor unificado
2. Implementar adapter con feature flag
3. Crear endpoints API
4. Testing con ejemplo laser-home

### Fase 2: Validación (Semana 3)
1. Comparar resultados: motor nuevo vs motor legacy
2. A/B testing con 10% de usuarios
3. Recopilar métricas de precisión y tiempo
4. Ajustar prompt según feedback

### Fase 3: Rollout Gradual (Semana 4)
1. Activar para 50% de usuarios nuevos
2. Monitorear errores y fallback rate
3. Si métricas son positivas (>95% éxito, <5% fallback): activar 100%

### Fase 4: Deprecación Legacy (Futuro)
1. Cuando el nuevo motor tenga >99% éxito por 30 días
2. Marcar motor legacy como deprecated
3. Plan de eliminación en siguiente release mayor

### Rollback Strategy
- Feature flag `USE_UNIFIED_ENGINE=false` desactiva instantáneamente
- No requiere deploy ni migración de datos
- El motor legacy sigue funcionando independientemente

## Open Questions

1. **¿Cuál es el límite práctico de cotizaciones por llamada?**
   - Teórico: 1000 páginas combinadas
   - Práctico: ¿8? ¿12? ¿20? Requiere testing con casos reales

2. **¿Cómo manejar cotizaciones escaneadas (imágenes)?**
   - Gemini 3.5 Flash soporta visión, pero ¿qué tan bien lee tablas escaneadas?
   - ¿Requerir OCR previo o dejar que el modelo lo maneje?

3. **¿El thinking level "medium" es suficiente para todos los casos?**
   - ¿Cuándo usar "high"? ¿Cotizaciones con 10+ aseguradoras?
   - ¿Impacto en latencia y costo?

4. **¿Cómo manejar correcciones del usuario?**
   - Si el analista corrige un valor, ¿se alimenta al prompt (few-shot)?
   - ¿Se guarda en base de datos para futuras comparaciones?
   - ¿O solo se aplica a la comparación actual?

5. **¿Qué pasa si una aseguradora no está en el prompt de ejemplo?**
   - ¿El prompt incluye una lista de aseguradoras conocidas?
   - ¿O es completamente genérico?
