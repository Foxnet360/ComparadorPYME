## ADDED Requirements

### Requirement: Negotiation opportunities analysis
The system SHALL identify specific negotiation opportunities for each quote based on coverage gaps and deductible levels.

#### Scenario: Negotiable deductible
- **WHEN** a quote has deductible "15%" for Incendio while market average is "10%"
- **THEN** the audit shows: "Oportunidad de negociación: Solicitar reducción de deducible del 15% al 10%"

#### Scenario: Missing coverage negotiation
- **WHEN** a quote is missing "Lucro Cesante" but includes all other coverages
- **THEN** the audit shows: "Oportunidad: Negociar inclusión de Lucro Cesante como valor agregado"

### Requirement: Competitive advantages identification
The system SHALL highlight unique advantages of each insurer compared to competitors in the same analysis.

#### Scenario: Exclusive coverage
- **WHEN** only one insurer offers "Asistencia Legal" in the current comparison
- **THEN** the audit highlights: "Ventaja competitiva: Única aseguradora con Asistencia Legal incluida"

#### Scenario: Best price for coverage bundle
- **WHEN** an insurer offers the lowest price while maintaining comparable coverage count
- **THEN** the audit shows: "Ventaja: Mejor relación precio/cobertura del mercado analizado"

### Requirement: Profile-based recommendations
The system SHALL provide coverage recommendations based on the client's business profile.

#### Scenario: Restaurant profile
- **WHEN** client profile indicates "restaurante" or "food service"
- **THEN** the audit prioritizes: RC ( Responsabilidad Civil), Incendio, and Equipo Eléctrico
- **AND** warns if these coverages are missing or have low values

#### Scenario: Retail store profile
- **WHEN** client profile indicates "tienda" or "retail"
- **THEN** the audit prioritizes: Sustracción/Hurto, Transporte de Mercancías, and RC

### Requirement: Cross-insurer risk comparison
The system SHALL compare risk levels across insurers for the same coverage.

#### Scenario: Deductible comparison
- **WHEN** comparing Incendio deductibles across 4 insurers
- **THEN** the audit shows a ranking: "Mejor deducible: AXA (5%) | Peor: BBVA (15%)"

#### Scenario: Coverage value comparison
- **WHEN** comparing RC coverage values across insurers
- **THEN** the audit flags: "ALERTA: CHUBB ofrece $100M de RC mientras el promedio del mercado es $500M"
