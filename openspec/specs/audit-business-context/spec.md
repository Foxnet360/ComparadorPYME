# Spec: Audit Business Context

## Capability
Enriquecimiento de la sección de auditoría con análisis de negociación, ventajas competitivas y recomendaciones basadas en el perfil del cliente.

## User Story
**Como** corredor de seguros
**Quiero** ver oportunidades de negociación y ventajas competitivas
**Para** tomar mejores decisiones para mis clientes

## Functional Requirements

### FR-1: Negotiation opportunities analysis
The system SHALL identify specific negotiation opportunities for each quote based on coverage gaps and deductible levels.

#### Scenario: Negotiable deductible
- **WHEN** a quote has deductible "15%" for Incendio while market average is "10%"
- **THEN** the audit shows: "Oportunidad de negociación: Solicitar reducción de deducible del 15% al 10%"
- **AND** includes potential savings estimate

#### Scenario: Missing coverage negotiation
- **WHEN** a quote is missing "Lucro Cesante" but includes all other coverages
- **THEN** the audit shows: "Oportunidad: Negociar inclusión de Lucro Cesante como valor agregado"

#### Scenario: Price negotiation
- **WHEN** a quote is 15% more expensive than average
- **THEN** the audit suggests: "Negociar descuento o mejorar coberturas"
- **AND** shows potential premium savings

### FR-2: Competitive advantages identification
The system SHALL highlight unique advantages of each insurer compared to competitors in the same analysis.

#### Scenario: Exclusive coverage
- **WHEN** only one insurer offers "Asistencia Legal" in the current comparison
- **THEN** the audit highlights: "Ventaja competitiva: Única aseguradora con Asistencia Legal incluida"

#### Scenario: Best price for coverage bundle
- **WHEN** an insurer offers the lowest price while maintaining comparable coverage count
- **THEN** the audit shows: "Ventaja: Mejor relación precio/cobertura del mercado analizado"

#### Scenario: Best deductibles
- **WHEN** an insurer has consistently lower deductibles than competitors
- **THEN** the audit highlights: "Ventaja: Mejores condiciones de deducibles del mercado"

### FR-3: Profile-based recommendations
The system SHALL provide coverage recommendations based on the client's business profile.

#### Scenario: Restaurant profile
- **WHEN** client profile indicates "restaurante" or "food service"
- **THEN** the audit prioritizes: RC (Responsabilidad Civil), Incendio, and Equipo Eléctrico
- **AND** warns if these coverages are missing or have low values

#### Scenario: Retail store profile
- **WHEN** client profile indicates "tienda" or "retail"
- **THEN** the audit prioritizes: Sustracción/Hurto, Transporte de Mercancías, and RC

#### Scenario: Manufacturing profile
- **WHEN** client profile indicates "manufactura" or "fábrica"
- **THEN** the audit prioritizes: Rotura de Maquinaria, Lucro Cesante, RC

#### Scenario: Office/Service profile
- **WHEN** client profile indicates "oficina" or "servicios"
- **THEN** the audit prioritizes: Equipo Electrónico, RC, Incendio

### FR-4: Cross-insurer risk comparison
The system SHALL compare risk levels across insurers for the same coverage.

#### Scenario: Deductible comparison
- **WHEN** comparing Incendio deductibles across 4 insurers
- **THEN** the audit shows a ranking: "Mejor deducible: AXA (5%) | Peor: BBVA (15%)"

#### Scenario: Coverage value comparison
- **WHEN** comparing RC coverage values across insurers
- **THEN** the audit flags: "ALERTA: CHUBB ofrece $100M de RC mientras el promedio del mercado es $500M"

## Dependencies
- Quote-based auditor service
- Profile detection (keywords in raw text)
- Market averages calculation