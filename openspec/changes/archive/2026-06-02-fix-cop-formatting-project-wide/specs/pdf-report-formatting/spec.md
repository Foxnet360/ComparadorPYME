## MODIFIED Requirements

### Requirement: PDF coverage values use Colombian formatting
All monetary values in the generated PDF report SHALL use the same Colombian currency formatting as the web UI.

#### Scenario: Coverage matrix in PDF
- **WHEN** generating the coverage matrix table in PDF
- **THEN** values like "500000000" display as "$500.000.000"

#### Scenario: Score display in PDF
- **WHEN** displaying insurer scores in PDF
- **THEN** scores maintain their current format (e.g., "68/100")

#### Scenario: PDF table layout preserved
- **WHEN** formatting is applied to PDF values
- **THEN** table columns do not break or overflow

#### Scenario: PDF premium values
- **WHEN** displaying premium breakdown in PDF
- **THEN** all monetary values use `formatCOP` with Colombian separators

### Requirement: PDF deductible section formatting
Deductible values in the PDF report SHALL use the same formatting as the web UI.

#### Scenario: Deductible text in PDF
- **WHEN** displaying deductible descriptions in PDF
- **THEN** percentage values use comma as decimal separator

#### Scenario: PDF price summary
- **WHEN** displaying price comparison in PDF
- **THEN** monetary values use `formatCOP` with Colombian separators
