## Context

El proyecto ComparadorPYME tiene 1,647 líneas de código distribuidas en 7 servicios backend, 7 componentes React y 6 endpoints API que implementan análisis avanzado de clausulados. Estas capacidades fueron construidas en el change anterior (`fortalecer-analisis-clausulados`) pero nunca se integraron en el flujo de usuario principal.

**Arquitectura actual:**
- Backend: Express con análisis en 5 fases (extracción, parseo, validación, scoring, narrativa)
- Frontend: React con pestañas (Resumen, Coberturas, Deducibles, Auditoría)
- Base de datos: Supabase PostgreSQL con pgvector
- AI: Google Gemini para extracción y RAG

**Problema central:** Los servicios calculan datos valiosos (validación de coberturas, riesgo de deducibles, exclusiones contextualizadas, opiniones legales) pero estos datos nunca llegan al frontend porque:
1. `analysisController.ts` no incluye los resultados en la respuesta JSON
2. `QuoteAnalysis` no tiene campos para estos datos
3. Los componentes existen pero no se importan en ningún lado
4. Los endpoints API son "huérfanos" - nadie los llama

## Goals / Non-Goals

**Goals:**
- Hacer visibles las validaciones de coberturas en el flujo principal de análisis
- Mostrar análisis de riesgo de deducibles por cobertura
- Integrar contextualización de exclusiones cuando exista perfil de cliente
- Exponer opiniones legales y puntos de negociación
- Mantener backward compatibility con el flujo existente
- Permitir rollout gradual con feature flags

**Non-Goals:**
- No modificar los algoritmos de análisis existentes
- No crear nuevos servicios de análisis
- No reemplazar el flujo actual, solo enriquecerlo
- No modificar la autenticación o autorización
- No cambiar el modelo de datos de cotizaciones

## Decisions

### 1. Estrategia de Integración: "Extensiones Opcionales"

**Decisión:** Extender la respuesta de `/api/analyze` con campos opcionales en vez de crear nuevos endpoints obligatorios.

**Rationale:**
- **Backward compatibility:** Clientes existentes ignoran campos nuevos
- **Simplicidad:** Un solo llamado al backend en vez de múltiples
- **Coherencia:** Todos los datos de una cotización van juntos
- **Performance:** Evita múltiples round-trips entre frontend y backend

**Alternativas consideradas:**
- Llamar endpoints `/api/analysis/*` desde frontend: Más flexible pero más lento y complejo
- WebSockets para streaming de resultados: Overkill para esta integración

### 2. Schema DB: Vista de Mapeo en vez de Migración Breaking

**Decisión:** Crear una vista `document_insurer_view` que exponga `insurer_name` en lugar de agregar la columna a `documents`.

**Rationale:**
- **No breaking:** No modifica tabla existente
- **Desnormalización controlada:** La vista puede materializarse si es necesario
- **Rollback simple:** DROP VIEW en vez de ALTER TABLE
- **Flexibilidad:** Permite mapear múltiples documentos a un nombre

**SQL propuesto:**
```sql
CREATE OR REPLACE VIEW document_insurer_view AS
SELECT d.*, i.name as insurer_name
FROM documents d
JOIN insurers i ON d.insurer_id = i.id;
```

**Alternativas consideradas:**
- Agregar columna `insurer_name` a `documents`: Rápido pero duplica datos
- JOIN en cada query: Correcto pero más código repetido

### 3. Feature Flags por Capability

**Decisión:** Un feature flag global (`VITE_ENABLE_ADVANCED_ANALYSIS`) en vez de flags por capability individual.

**Rationale:**
- **Simplicidad:** Una sola variable controla todo
- **All-or-nothing:** Las capabilities están interrelacionadas (legal-opinion necesita clause-validation)
- **Facilidad de rollback:** Un solo switch para desactivar todo

**Implementación:**
```typescript
// config/features.ts
export const FEATURES = {
  ADVANCED_ANALYSIS: import.meta.env.VITE_ENABLE_ADVANCED_ANALYSIS === 'true'
};
```

**Alternativas consideradas:**
- Flags por capability: Más granular pero más complejo de gestionar
- Flags por entorno: Menos flexible

### 4. Estrategia de UI: Pestaña Condicional

**Decisión:** Nueva pestaña "Análisis Avanzado" que solo aparece cuando hay datos disponibles.

**Rationale:**
- **Descubrimiento:** Los usuarios encuentran las capacidades cuando son relevantes
- **No overwhelm:** No muestra UI vacía si no hay datos
- **Organización:** Agrupa capacidades relacionadas en un solo lugar

**Condición de visibilidad:**
```typescript
const showAdvancedTab = quote.clauseValidation || 
                        quote.deductibleAnalysis || 
                        quote.contextualRisk;
```

**Alternativas consideradas:**
- Integrar en pestaña Auditoría existente: Podría saturar la UI
- Modal/popup: Menos descubrible

### 5. Llamadas a Servicios: Paralelo con Fallback

**Decisión:** Llamar a servicios de análisis avanzado en paralelo con el flujo principal, usando `Promise.allSettled` para manejar fallos gracefully.

**Rationale:**
- **Performance:** No bloquea el flujo principal
- **Resiliencia:** Si un servicio falla, los demás continúan
- **Debuggable:** Los errores se loguean pero no rompen la experiencia

**Implementación en analysisController:**
```typescript
// Phase 4b: Validar en paralelo con scoring
const [clauseValidation, deductibleAnalysis, ...] = await Promise.allSettled([
  clauseCoverageValidator.validate(quote, insurerName),
  deductibleAnalyzer.analyzeQuote(quote, clauseDeductibles),
  // ... otros servicios
]);
```

**Alternativas consideradas:**
- Llamadas secuenciales: Más lento
- Llamadas lazy desde frontend: Más round-trips

## Risks / Trade-offs

### [Riesgo] Performance del análisis principal

**Problema:** Llamar a múltiples servicios en paralelo puede aumentar el tiempo de respuesta de `/api/analyze`.

**Mitigación:**
- Usar `Promise.allSettled` con timeout por servicio (5s)
- Si un servicio tarda, se incluye en respuesta como `null` (lazy loading)
- Cachear resultados de clauseValidation por (quoteHash, insurerName)

### [Riesgo] Dependencia de tabla clause_chunks

**Problema:** Los servicios de validación dependen de `clause_chunks` y `match_clauses()`, que pueden no tener datos en producción.

**Mitigación:**
- Los servicios ya tienen fallback a EXPECTED_COVERAGES si no hay RAG
- Documentar en deployment que se necesita seedear clausulados
- Mostrar warning en UI si `hasClauseDocument === false`

### [Riesgo] Schema inconsistency entre chunks y clause_chunks

**Problema:** Existen dos sistemas de chunks (`chunks` con 3072 dims y `clause_chunks` con 768 dims).

**Mitigación:**
- Esta integración usa `clause_chunks` (ya lo hacen los servicios)
- Planificar unificación en change futuro
- No modificar los embeddings existentes

### [Riesgo] Breaking change potencial

**Problema:** Si algo falla en la integración, puede afectar el flujo principal que funciona.

**Mitigación:**
- Feature flag permite desactivar instantáneamente
- Campos opcionales en respuesta JSON
- Try-catch wrappers alrededor de cada servicio nuevo
- Monitorear errores en `/api/analyze`

## Migration Plan

### Fase 1: Preparación (0 riesgo)
1. Crear vista `document_insurer_view` en Supabase
2. Agregar feature flag `VITE_ENABLE_ADVANCED_ANALYSIS=false` en Railway
3. Extender tipos TypeScript (`QuoteAnalysis` con campos opcionales)

### Fase 2: Backend Integration (bajo riesgo)
1. Modificar `analysisController.ts` para incluir clauseValidationResults en respuesta
2. Wrappar servicios con try-catch y timeout
3. Deploy con feature flag APAGADO

### Fase 3: Frontend Dashboard (bajo riesgo)
1. Conectar `AuditDashboard.tsx` a datos reales (condicional)
2. Mostrar métricas solo cuando existan datos
3. Activar flag en staging para validar

### Fase 4: Nueva Pestaña (medio riesgo)
1. Crear pestaña "Análisis Avanzado" en `ComparisonReport.tsx`
2. Importar componentes existentes
3. Crear hook `useAdvancedAnalysis`
4. Validar con usuarios reales

### Fase 5: Rollout Gradual
1. Activar flag para 10% de usuarios
2. Monitorear errores y performance
3. Aumentar a 50%, luego 100%

### Rollback
```bash
# Instantáneo via Railway Dashboard
VITE_ENABLE_ADVANCED_ANALYSIS=false
```

## Open Questions

1. **¿Deberíamos cachear los resultados de clauseValidation?** Los resultados son determinísticos para un par (quote, insurer), podríamos cachear en Redis o Supabase para acelerar re-análisis.

2. **¿Qué hacer cuando `insurerName` no mapea a un insurer_id?** Algunos nombres pueden tener variaciones ("Bolívar" vs "Seguros Bolívar"). ¿Usar fuzzy matching o normalización?

3. **¿Debería el análisis avanzado ser un endpoint separado en vez de extender `/api/analyze`?** Para usuarios que solo quieren análisis básico, el endpoint extendido podría ser más lento.

4. **¿Cómo manejamos la falta de datos en clause_chunks?** Actualmente los servicios fallback a EXPECTED_COVERAGES hardcodeados. ¿Deberíamos mostrar un mensaje "Sin clausulado disponible" en la UI?
