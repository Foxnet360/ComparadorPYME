## ADDED Requirements

### Requirement: Extract special conditions from quote raw text
The system SHALL parse the raw text extracted from quote PDFs to identify special conditions, exclusions, and limitations.

#### Scenario: Condition pattern detection
- **WHEN** the raw text contains phrases: "Condición especial:", "Nota importante:", "Advertencia:", "Sujeto a:"
- **THEN** the system SHALL extract the text following these markers (up to next period or newline)
- **AND** associate it with the nearest coverage name (if identifiable)
- **AND** store in quote.specialConditions array

#### Scenario: Exclusion pattern detection
- **WHEN** the raw text contains: "No cubre", "Excluye", "Exclusión:", "Quedan excluidos"
- **THEN** the system SHALL extract the excluded items as a list
- **AND** flag as high-priority audit item

#### Scenario: Limitation pattern detection
- **WHEN** the raw text contains: "Limitado a:", "Máximo:", "Hasta:", "Topes:"
- **THEN** the system SHALL extract the limitation value and context
- **AND** associate with relevant coverage

### Requirement: Classify special conditions by impact
The system SHALL classify extracted special conditions by their potential impact on coverage.

#### Scenario: Critical condition classification
- **WHEN** a condition contains words like "exclusión total", "anulación", "rescisión"
- **THEN** classify as CRITICAL impact
- **AND** display prominently in audit with red badge

#### Scenario: Warning condition classification
- **WHEN** a condition contains words like "limitado", "subjetivo", "a discreción"
- **THEN** classify as WARNING impact
- **AND** display with yellow badge

#### Scenario: Informational condition classification
- **WHEN** a condition contains standard administrative text ("Plazo de vigencia", "Forma de pago")
- **THEN** classify as INFO impact
- **AND** display with blue badge

### Requirement: Display conditions in audit section
The system SHALL display extracted special conditions in the audit section grouped by insurer.

#### Scenario: Conditions per insurer
- **WHEN** the user views the audit section
- **THEN** special conditions are grouped under each insurer's section
- **AND** sorted by impact level (CRITICAL first, then WARNING, then INFO)

#### Scenario: Cross-insurer condition comparison
- **WHEN** the same condition appears in multiple insurers
- **THEN** group them under "Condiciones Cruzadas"
- **AND** highlight differences in wording or impact
