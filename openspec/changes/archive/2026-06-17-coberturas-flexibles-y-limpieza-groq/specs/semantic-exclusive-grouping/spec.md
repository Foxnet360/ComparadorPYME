## ADDED Requirements

### Requirement: Semantic Grouping of Exclusive Coverages
The system MUST group exclusive coverage rows semantically to merge minor insurer naming variations and eliminate duplicate matrix rows.

#### Scenario: Merging variations
- **GIVEN** raw coverages with slight naming variations (e.g., "Robo con Violencia" and "Robo y/o Asalto")
- **WHEN** the exclusive coverage matrix is rendered
- **THEN** the system SHALL group them semantically into a single row using a similarity threshold
- **AND** it MUST show separate columns for each insurer under the merged row.
