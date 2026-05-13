# Spec: Deductible Extraction V2

## Capability
Extracción mejorada de deducibles de cotizaciones mediante schema obligatorio, prompts multi-página, y fallback inteligente basado en tipo de cobertura.

## User Story
**Como** sistema de análisis
**Quiero** extraer deducibles de forma precisa de todas las páginas del PDF
**Para** evitar valores "NO ESPECIFICADO" y proporcionar análisis de riesgo real

## ADDED Requirements

### Requirement: Schema V2 obligatorio para deducibles
El system SHALL requerir que Gemini extraiga deducibles para cada cobertura, sin permitir valores nulos.

#### Scenario: Deductible específico encontrado
- **WHEN** una cobertura tiene deducible en el PDF
- **THEN** el schema SHALL extraer el texto exacto del deducible
- **AND** el campo deductible SHALL NOT ser null

#### Scenario: Cobertura sin deducible
- **WHEN** una cobertura típicamente no tiene deducible (ej: Asistencia PYME)
- **THEN** el system SHALL usar valor "No aplica"
- **AND** SHALL NOT usar "NO ESPECIFICADO"

#### Scenario: Deductible en página separada
- **WHEN** los deducibles están en página 2+ del PDF (formato HDI)
- **THEN** Gemini SHALL buscar en TODAS las páginas antes de asignar "No aplica"

### Requirement: Prompts multi-página para todas las familias de formato
El system SHALL incluir instrucción explícita de búsqueda multi-página en TODOS los prompts especializados.

#### Scenario: TABLE-DOUBLE (HDI)
- **WHEN** se procesa cotización HDI
- **THEN** el prompt SHALL instruir: "Los deducibles están en página 2, tabla separada"

#### Scenario: TABLE-INTEGRATED (CHUBB)
- **WHEN** se procesa cotización CHUBB
- **THEN** el prompt SHALL instruir: "Revisar TODAS las páginas para deducibles, pueden estar en sección de condiciones"

#### Scenario: SECTIONS (MAPFRE)
- **WHEN** se procesa cotización MAPFRE
- **THEN** el prompt SHALL instruir: "Cada sección PRIMERA, SEGUNDA, etc. tiene su propio deducible. Extraer de cada sección."

#### Scenario: DESCRIPTIVE (AXA)
- **WHEN** se procesa cotización AXA
- **THEN** el prompt SHALL instruir: "Buscar deducibles en texto descriptivo y cláusulas al final del documento"

#### Scenario: PRICE-TABLE (SBS)
- **WHEN** se procesa cotización SBS
- **THEN** el prompt SHALL instruir: "La tabla de primas puede incluir deducibles por cobertura en columna separada"

#### Scenario: TEXT (BOLÍVAR)
- **WHEN** se procesa cotización BOLÍVAR
- **THEN** el prompt SHALL instruir: "Buscar deducibles en cláusulas y condiciones especiales al final"

### Requirement: Fallback inteligente basado en tipo de cobertura
El system SHALL usar lógica de fallback que distinga entre "sin deducible" y "no encontrado".

#### Scenario: Cobertura de servicio
- **WHEN** una cobertura es Asistencia PYME, Asistencia Legal, u otro servicio
- **AND** no se encontró deducible en el PDF
- **THEN** el fallback SHALL asignar "No aplica"

#### Scenario: Cobertura material con deducible esperado
- **WHEN** una cobertura es Incendio, Sustracción, Rotura de Maquinaria, etc.
- **AND** no se encontró deducible en el PDF
- **THEN** el fallback SHALL buscar en generalDeductibles antes de "NO ESPECIFICADO"

#### Scenario: Deductible general aplicable
- **WHEN** generalDeductibles tiene entrada que aplica a la cobertura
- **THEN** el system SHALL asignar ese deducible general a la cobertura

### Requirement: Validación de formatos de deducible colombianos
El system SHALL reconocer formatos comunes de deducibles en cotizaciones colombianas.

#### Scenario: Porcentaje con mínimo
- **WHEN** el deducible es "10% PERD Min 1 SMMLV"
- **THEN** el validator SHALL reconocerlo como formato válido

#### Scenario: SMMLV fijo
- **WHEN** el deducible es "5 SMMLV"
- **THEN** el validator SHALL reconocerlo como formato válido

#### Scenario: Sin deducible explícito
- **WHEN** el deducible es "Sin deducible", "No aplica", "Aplica", "Incluido"
- **THEN** el validator SHALL reconocerlo como formato válido

#### Scenario: Valor monetario
- **WHEN** el deducible es "$500.000" o "500.000 COP"
- **THEN** el validator SHALL reconocerlo como formato válido

## Dependencies
- `multimodal-pdf-extraction` para extracción de PDF
- `coverage-post-normalization` para asignación de deducibles generales
