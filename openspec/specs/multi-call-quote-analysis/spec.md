# Spec: Multi-Call Quote Analysis

## Capability
Análisis de cotizaciones usando múltiples llamadas a Gemini en fases separadas para evitar truncamiento de JSON y mejorar fiabilidad.

## User Story
**Como** usuario del comparador de seguros
**Quiero** que el sistema analice 3-5 cotizaciones de forma fiable
**Para** obtener un análisis completo sin errores de truncamiento

## Functional Requirements

### FR-1: Extracción estructurada de cotizaciones
The system SHALL extraer datos estructurados de 3-5 cotizaciones de seguros en una sola llamada a Gemini, produciendo un JSON plano con datos brutos.

#### Scenario: Extracción exitosa de 3 cotizaciones
- **WHEN** el usuario envía 3 cotizaciones en formato PDF
- **THEN** la Fase 1 extrae: nombre aseguradora, nombre póliza, prima anual, moneda, y lista de coberturas con valor y deducible
- **AND** el output es un array de objetos planos sin análisis ni scoring

#### Scenario: Cotización con datos incompletos
- **WHEN** una cotización no especifica un valor asegurado
- **THEN** el campo value contiene "NO ESPECIFICADO"
- **AND** el campo deductible contiene "No aplica" o "N/A"

### FR-2: Scoring y alertas por cotización
The system SHALL calcular un score numérico (0-100) y generar alerts de riesgo para cada cotización extraída, basándose únicamente en los datos de la Fase 1.

#### Scenario: Scoring de cotización completa
- **WHEN** la Fase 1 entrega datos de N cotizaciones
- **THEN** la Fase 2 calcula: score total, breakdown por dimensión (coverage, deductibles, exclusions, priceRatio, sublimits, warranties), y alerts críticas/warnings
- **AND** cada alert incluye level, title y description

#### Scenario: Cotización con deducibles altos
- **WHEN** una cotización tiene deducibles superiores al 10% del valor asegurado
- **THEN** se genera una alert CRITICAL indicando el riesgo financiero

### FR-3: Análisis narrativo consolidado
The system SHALL generar una recomendación final y análisis de mercado basado en los resultados de las Fases 1 y 2.

#### Scenario: Recomendación con múltiples cotizaciones
- **WHEN** existen 3+ cotizaciones con scoring completado
- **THEN** la Fase 3 genera: recommendation (qué cotización elegir y por qué) y marketAnalysis (tendencias observadas)
- **AND** ambos campos son texto libre de máximo 2000 caracteres cada uno

### FR-4: Token counting preventivo
The system SHALL calcular tokens antes de enviar a Gemini y prevenir envíos que excedan el 80% de la ventana de contexto.

#### Scenario: Input demasiado grande
- **WHEN** el texto combinado de cotizaciones excede el límite seguro
- **THEN** el sistema divide automáticamente en lotes de 2 cotizaciones
- **AND** procesa cada lote por separado, mergeando resultados al final

## Dependencies
- Gemini API con soporte para conteo de tokens
- Servicio de extracción de texto de PDF

## Non-Functional Requirements
- Tiempo total de análisis < 30 segundos para 3-5 cotizaciones
- Tolerancia a fallos: si una fase falla, reintentar con lotes más pequeños
