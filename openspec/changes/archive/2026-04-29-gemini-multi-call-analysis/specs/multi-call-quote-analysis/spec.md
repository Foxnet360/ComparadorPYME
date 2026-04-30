## ADDED Requirements

### Requirement: Extracción estructurada de cotizaciones
The system SHALL extraer datos estructurados de 3-5 cotizaciones de seguros en una sola llamada a Gemini, produciendo un JSON plano con datos brutos.

#### Scenario: Extracción exitosa de 3 cotizaciones
- **WHEN** el usuario envía 3 cotizaciones en formato PDF
- **THEN** la Fase 1 extrae: nombre aseguradora, nombre póliza, prima anual, moneda, y lista de coberturas con valor y deducible
- **AND** el output es un array de objetos planos sin análisis ni scoring

#### Scenario: Cotización con datos incompletos
- **WHEN** una cotización no especifica un valor asegurado
- **THEN** el campo value contiene "NO ESPECIFICADO"
- **AND** el campo deductible contiene "No aplica" o "N/A"

### Requirement: Scoring y alertas por cotización
The system SHALL calcular un score numérico (0-100) y generar alerts de riesgo para cada cotización extraída, basándose únicamente en los datos de la Fase 1.

#### Scenario: Scoring de cotización completa
- **WHEN** la Fase 1 entrega datos de N cotizaciones
- **THEN** la Fase 2 calcula: score total, breakdown por dimensión (coverage, deductibles, exclusions, priceRatio, sublimits, warranties), y alerts críticas/warnings
- **AND** cada alert incluye level, title y description

#### Scenario: Cotización con deducibles altos
- **WHEN** una cotización tiene deducibles superiores al 10% del valor asegurado
- **THEN** se genera una alert CRITICAL indicando el riesgo financiero

### Requirement: Análisis narrativo consolidado
The system SHALL generar una recomendación final y análisis de mercado basado en los resultados de las Fases 1 y 2.

#### Scenario: Recomendación con múltiples cotizaciones
- **WHEN** existen 3+ cotizaciones con scoring completado
- **THEN** la Fase 3 genera: recommendation (qué cotización elegir y por qué) y marketAnalysis (tendencias observadas)
- **AND** ambos campos son texto libre de máximo 2000 caracteres cada uno

### Requirement: Token counting preventivo
The system SHALL calcular tokens antes de enviar a Gemini y prevenir envíos que excedan el 80% de la ventana de contexto.

#### Scenario: Input demasiado grande
- **WHEN** el texto combinado de cotizaciones excede el límite seguro
- **THEN** el sistema divide automáticamente en lotes de 2 cotizaciones
- **AND** procesa cada lote por separado, mergeando resultados al final

## MODIFIED Requirements

### Requirement: Análisis de cotizaciones (existente en quote-analysis-v2)
**FROM**: El sistema analiza cotizaciones Y clausulados en una sola llamada, generando un JSON completo con 14 coberturas, scoring, alerts, comparaciones y análisis narrativo.

**TO**: El sistema analiza SOLO cotizaciones, dividiendo el proceso en 3 fases independientes. Los clausulados se procesarán en un flujo separado futuro.