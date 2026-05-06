# Design: Fortalecer Análisis con Clausulados

## Context

El sistema actual de análisis de cotizaciones tiene una arquitectura de 3 capas:

1. **Extracción**: PDF → Texto → Datos estructurados (quoteParser.ts)
2. **Validación**: Datos estructurados → Alertas (quoteValidator.ts, crossReferenceEngine.ts)
3. **Scoring**: Alertas + Datos → Score numérico (quoteScorer.ts)

Los clausulados se usan actualmente en la capa de validación (crossReferenceEngine.ts) para comparar deducibles quote vs clausulado, pero son **opcionales**. Si no hay clausulado para una aseguradora, el scoring asigna 50/100 (neutral) a las dimensiones dependientes del clausulado.

La arquitectura RAG ya existe (ragRetrievalService.ts) con embeddings en Supabase (chunks table, 3072d) y funciones de búsqueda híbrida (vector + full-text).

## Goals / Non-Goals

**Goals:**
- Transformar clausulados de "opcional" a "obligatorio" en el análisis
- Detectar coberturas "fantasma" (en quote pero no en clausulado)
- Detectar coberturas obligatorias omitidas (en clausulado pero no en quote)
- Analizar riesgo real de deducibles vs suma asegurada
- Contextualizar exclusiones por perfil del cliente
- Clasificar condiciones de cumplimiento por dificultad
- Comparar versiones de clausulados
- Generar opiniones legales personalizadas con RAG

**Non-Goals:**
- No se modifica el flujo de extracción de cotizaciones (quoteParser.ts)
- No se modifica el sistema de autenticación
- No se modifica la biblioteca de clausulados existente (solo se consume)
- No se implementa procesamiento de lenguaje natural complejo custom (se usa Gemini)
- No se soportan clausulados escaneados/OCR de baja calidad (requieren pre-procesamiento manual)

## Decisions

### 1. Arquitectura: Micro-servicios por fase

**Decision:** Implementar cada fase como servicios independientes que se integran en el pipeline existente.

**Rationale:**
- Permite despliegue progresivo (una fase a la vez)
- Facilita testing aislado
- Reduce riesgo de regresión

**Alternatives considered:**
- Modificar monolíticamente crossReferenceEngine.ts → Rechazado: Riesgo alto de regresión
- Crear un solo servicio gigante → Rechazado: Difícil de testear y mantener

### 2. Validación bidireccional síncrona

**Decision:** La validación de coberturas (quote ↔ clausulado) ocurre sincrónicamente durante el análisis, no en background.

**Rationale:**
- El corredor necesita ver resultados inmediatos
- No se puede generar score completo sin esta validación

**Trade-off:** Aumenta tiempo de análisis en ~2-3 segundos por cotización.

### 3. Perfil de cliente: Opcional pero incentivado

**Decision:** Las capacidades de contextualización (Fase 3) funcionan en modo degradado si no hay perfil del cliente, pero muestran un banner incentivando completarlo.

**Rationale:**
- No todos los clientes tienen perfil completo
- El análisis genérico sigue siendo útil

### 4. Extracción de datos del clausulado: Gemini + Fallback regex

**Decision:** Usar Gemini Flash para extracción estructurada de coberturas del clausulado, con fallback a regex simple si Gemini falla.

**Rationale:**
- Los clausulados son documentos legales complejos, regex no es suficiente
- Gemini Flash es rápido y barato ($0.01-0.02 por documento)
- Fallback asegura que el sistema no se rompe si falla la API

**Alternatives considered:**
- Regex puro → Rechazado: No maneja variabilidad de formatos
- Entrenar modelo custom → Rechazado: Costoso y requiere dataset grande

### 5. Base de datos: Nuevas tablas en Supabase

**Decision:** Crear nuevas tablas en Supabase (no modificar las existentes) para:
- `client_profiles`: Perfil del cliente
- `clause_coverages`: Coberturas extraídas de clausulados
- `clause_versions`: Versiones de clausulados
- `contextual_risk_analysis`: Análisis contextualizado

**Rationale:**
- Mantiene integridad de datos existentes
- Facilita migración y rollback
- Permite relaciones claras

### 6. API: Endpoints REST nuevos

**Decision:** Crear endpoints REST separados para cada capacidad nueva, no modificar `/api/analyze` existente.

**Rationale:**
- Mantiene compatibilidad hacia atrás
- Facilita testing
- Permite llamada selectiva según necesidad

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS PIPELINE EXISTENTE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PDF Quotes → quoteParser → quoteValidator → crossRefEngine     │
│                    ↓                      ↓                      │
│              ParsedQuote          CrossRefResult                │
│                    ↓                      ↓                      │
│                    └──────────┬──────────┘                       │
│                               ↓                                  │
│                         quoteScorer                              │
│                               ↓                                  │
│                         Narrative                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  NUEVOS SERVICIOS (Fases 1-4)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FASE 1: clauseCoverageValidator                                │
│    ├── Validar existencia (quote → clause)                      │
│    ├── Validar inversa (clause → quote)                         │
│    └── Impacto en scoring (penalizaciones)                      │
│                                                                  │
│  FASE 2: deductibleAnalyzer                                     │
│    ├── Calcular deducible real vs suma asegurada               │
│    ├── Detectar topes y proporciones                           │
│    └── Generar alertas de riesgo                                │
│                                                                  │
│       inverseCoverageChecker                                    │
│    └── Detectar coberturas obligatorias omitidas               │
│                                                                  │
│       clauseVersionComparator                                   │
│    └── Comparar versiones de clausulados                       │
│                                                                  │
│  FASE 3: contextualRiskAnalyzer                                 │
│    ├── Contextualizar exclusiones por perfil                   │
│    └── Sugerir mitigaciones                                     │
│                                                                  │
│       warrantyComplianceAnalyzer                                │
│    ├── Clasificar condiciones por tipo/dificultad              │
│    └── Calcular riesgo de incumplimiento                       │
│                                                                  │
│  FASE 4: virtualLawyerService                                   │
│    ├── Generar opiniones legales                                │
│    ├── Identificar puntos de negociación                       │
│    └── Citas de clausulado como evidencia                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. quoteParser extrae coberturas de la cotización
   ↓
2. clauseCoverageValidator busca cada cobertura en clausulado (RAG)
   ↓
3. Si existe en clausulado → ✅ Verificada
   Si NO existe en clausulado → 🔴 Fantasma (alerta CRITICAL)
   ↓
4. inverseCoverageChecker busca coberturas obligatorias del clausulado
   ↓
5. Si obligatoria y NO en quote → ⚠️ Omitida (alerta WARNING)
   ↓
6. quoteScorer calcula score con penalizaciones
   ↓
7. deductibleAnalyzer calcula riesgo de deducibles
   ↓
8. (Si cliente tiene perfil) contextualRiskAnalyzer enriquece exclusiones
   ↓
9. warrantyComplianceAnalyzer clasifica condiciones
   ↓
10. virtualLawyerService genera opinión legal (opcional, bajo demanda)
```

## Database Schema Additions

```sql
-- Perfil de cliente para contextualización
CREATE TABLE client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  industry_type TEXT CHECK (industry_type IN ('manufactura', 'comercio', 'servicios', 'construccion', 'transporte', 'otro')),
  location_city TEXT,
  location_zone TEXT CHECK (location_zone IN ('costera', 'montana', 'urbana', 'industrial', 'rural')),
  has_single_supplier BOOLEAN DEFAULT false,
  employee_count INTEGER,
  building_type TEXT CHECK (building_type IN ('propio', 'arrendado', 'mixto')),
  primary_activity TEXT,
  annual_revenue BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coberturas extraídas de clausulados (para validación inversa)
CREATE TABLE clause_coverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  coverage_name TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT false,
  deductible_text TEXT,
  exclusions TEXT[],
  conditions TEXT[],
  page_number INTEGER,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historial de versiones de clausulados
CREATE TABLE clause_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  parent_version_id UUID REFERENCES clause_versions(id),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Análisis de riesgo contextualizado
CREATE TABLE contextual_risk_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_history_id UUID REFERENCES analysis_history(id) ON DELETE CASCADE,
  coverage_name TEXT,
  risk_type TEXT,
  risk_level TEXT,
  explanation TEXT,
  mitigation_suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_client_profiles_client ON client_profiles(client_id);
CREATE INDEX idx_clause_coverages_document ON clause_coverages(document_id);
CREATE INDEX idx_clause_coverages_name ON clause_coverages(coverage_name);
CREATE INDEX idx_clause_versions_document ON clause_versions(document_id);
CREATE INDEX idx_contextual_risk_analysis_history ON contextual_risk_analysis(analysis_history_id);
```

## API Endpoints

```
# Fase 1
POST /api/analysis/validate-coverages
Request: { quoteId, insurerName, coverageNames[] }
Response: { results[], phantomCount, mandatoryMissingCount, scoreImpact }

# Fase 2
POST /api/analysis/deductible-risk
Request: { quoteId, coverageName, deductibleText, insuredAmount }
Response: { analysis: DeductibleAnalysis, alertLevel, recommendation }

POST /api/analysis/inverse-check
Request: { quoteId, clauseDocumentId }
Response: { results[], mandatoryMissingCount, optionalMissingCount }

# Fase 3
POST /api/analysis/contextualize
Request: { analysisId, clientProfile }
Response: { exclusions[], criticalCount, highCount, mediumCount, lowCount }

POST /api/analysis/warranty-compliance
Request: { quoteId, clauseDocumentId, clientProfile }
Response: { summary, conditions[], recommendations[] }

# Fase 4
POST /api/analysis/legal-opinion
Request: { quoteId, coverageNames[], clientProfile }
Response: { opinions[], highPriorityPoints[], overallRiskAssessment }
```

## Integration Points

### 1. quoteScorer.ts (Modificación)

```typescript
// Nuevo parámetro opcional
function calculateScore(
  quote: ParsedQuote,
  crossRefResults: CrossReferenceResult[],
  clauseValidation?: CoverageExistenceResult[],  // NUEVO
  allQuotes: ParsedQuote[] = [],
  customWeights?: Partial<ScoreWeights>
): ScoringResult {
  
  // Modificar calculateCoverageScore
  const coverage = calculateCoverageScore(quote, clauseValidation);
  
  // Modificar calculateDeductibleScore
  const deductibles = calculateDeductibleScore(crossRefResults);
  // Si no hay clausulado, retornar 30 (no 50)
}
```

### 2. crossReferenceEngine.ts (Extensión)

```typescript
// Extender interface ClauseData
interface ClauseData {
  value?: string;
  deductible?: string;
  exclusions?: string[];
  conditions?: string[];
  hasCap?: boolean;           // NUEVO
  capAmount?: number;         // NUEVO
  isMandatory?: boolean;      // NUEVO
  clauseReference?: string;   // NUEVO
}
```

### 3. analysisController.ts (Modificación)

```typescript
// En uploadAndAnalyze, agregar llamada a validación
const clauseValidation = await clauseCoverageValidator.validate(quote);
const scoreResult = quoteScorer.calculateScore(quote, crossRefs, clauseValidation);
```

## Frontend Components

### Nuevos Componentes

1. **CoverageValidationMatrix**
   - Muestra grid: Cobertura × Estado (Verificada/Fantasma/Omitida)
   - Colores: Verde/Amarillo/Rojo
   - Ubicación: Tab de Coberturas

2. **DeductibleRiskGauge**
   - Gauge visual con escala 0-100%
   - Tooltip con deducible calculado en pesos
   - Ubicación: Tab de Deducibles

3. **ContextualExclusionCard**
   - Tarjeta expandible con exclusión + contexto + mitigación
   - Ubicación: Tab de Auditoría

4. **WarrantyComplianceDashboard**
   - Dashboard con 4 gauges (Documental/Operacional/Técnica/Financiera)
   - Lista de condiciones de alto riesgo
   - Ubicación: Tab de Auditoría (modo técnico)

### Componentes Modificados

1. **AuditDashboard.tsx**
   - Agregar métricas: Coberturas fantasma, Riesgo de deducibles
   - Agregar gráfico de cumplimiento de garantías

2. **AuditSection.tsx**
   - Integrar ContextualExclusionCard en alertas enriquecidas
   - Mostrar badge "Riesgo contextualizado: CRÍTICO"

3. **ComparisonReport.tsx**
   - Agregar indicadores de validación en matriz de coberturas
   - Mostrar warning si hay coberturas fantasmas

## Risks / Trade-offs

### [Riesgo] Performance: Tiempo de análisis aumenta
- **Impacto**: De ~15s a ~25-30s por cotización
- **Mitigación**: 
  - Cache de resultados de validación (sessionStorage)
  - Llamadas paralelas a servicios independientes
  - Lazy loading de análisis contextualizado (Fase 3)

### [Riesgo] Regresión en scoring existente
- **Impacto**: Cambios en quoteScorer.ts pueden afectar scores actuales
- **Mitigación**:
  - Tests exhaustivos con casos de prueba existentes
  - Scoring en "shadow mode" durante 2 semanas
  - Comparación de scores antes/después

### [Riesgo] Dependencia de Gemini para extracción
- **Impacto**: Si falla API, no se pueden validar coberturas
- **Mitigación**:
  - Fallback a regex simple (menos preciso pero funcional)
  - Cache de extracciones previas
  - Retry con backoff exponencial

### [Riesgo] Datos del cliente incompletos
- **Impacto**: Contextualización (Fase 3) no funciona sin perfil
- **Mitigación**:
  - Funciona en modo degradado (análisis genérico)
  - Banner incentivando completar perfil
  - Pre-población con datos conocidos

### [Riesgo] Complejidad de prompts para Gemini
- **Impacto**: Prompts complejos pueden dar resultados inconsistentes
- **Mitigación**:
  - Prompts versionados en archivos separados
  - Temperature = 0 para consistencia
  - Validación estructurada de respuestas (JSON schema)

### [Trade-off] Precisión vs Velocidad
- **Situación**: Análisis más profundo = más tiempo
- **Decisión**: Aceptar 25-30s de análisis (vs 15s actual) a cambio de mayor precisión
- **Justificación**: El corredor prefiere esperar 10s más a recibir un análisis incompleto

## Migration Plan

### Fase 1: Coverage Validation (2-3 semanas)
1. Crear tabla `clause_coverages`
2. Implementar `clauseCoverageValidator.ts`
3. Modificar `quoteScorer.ts` (penalización por ausencia)
4. Crear endpoint `/api/analysis/validate-coverages`
5. Crear componente `CoverageValidationMatrix.tsx`
6. Tests de integración

### Fase 2: Deductible Risk + Inverse Check (3-4 semanas)
1. Implementar `deductibleAnalyzer.ts`
2. Implementar `inverseCoverageChecker.ts`
3. Implementar `clauseVersionComparator.ts`
4. Crear tablas `clause_versions`
5. Crear endpoints `/api/analysis/deductible-risk`, `/api/analysis/inverse-check`
6. Crear componentes `DeductibleRiskGauge.tsx`
7. Tests de integración

### Fase 3: Contextual Risk + Warranty Compliance (4-5 semanas)
1. Crear tabla `client_profiles`
2. Implementar `contextualRiskAnalyzer.ts`
3. Implementar `warrantyComplianceAnalyzer.ts`
4. Crear tabla `contextual_risk_analysis`
5. Crear endpoints `/api/analysis/contextualize`, `/api/analysis/warranty-compliance`
6. Crear componentes `ContextualExclusionCard.tsx`, `WarrantyComplianceDashboard.tsx`
7. Tests de integración

### Fase 4: Virtual Lawyer (5-6 semanas)
1. Implementar `virtualLawyerService.ts`
2. Crear endpoint `/api/analysis/legal-opinion`
3. Integrar con chat existente
4. Tests de integración

### Rollback Strategy
- Cada fase es independiente y puede desactivarse con feature flag
- Si hay problemas, se puede volver a scoring neutral (50/100) cambiando una constante
- Base de datos: Las tablas nuevas no afectan las existentes

## Open Questions

1. **¿Qué tan estructurados están los clausulados de las 24 aseguradoras?**
   - Si son PDFs escaneados de baja calidad, la extracción con Gemini puede fallar
   - **Action item**: Auditar calidad de clausulados existentes

2. **¿El corredor tiene datos del cliente en el momento del análisis?**
   - Si no, Fase 3 requiere que el corredor los ingrese
   - **Action item**: Definir flujo de captura de perfil del cliente

3. **¿Con qué frecuencia cambian los clausulados?**
   - Si cambian anualmente, la comparación de versiones (Fase 2) es útil
   - Si cambian cada 5 años, puede no valer la pena
   - **Action item**: Consultar frecuencia de actualización con aseguradoras

4. **¿Cuál es el presupuesto para llamadas a Gemini?**
   - Fase 4 (Virtual Lawyer) puede requerir múltiples llamadas por análisis
   - **Action item**: Estimar costo con datos de uso actual

5. **¿Se requiere aprobación legal para las "opiniones legales"?**
   - Un LLM no es un abogado, podría haber implicaciones legales
   - **Action item**: Consultar con equipo legal antes de Fase 4
