## ADDED Requirements

### Requirement: Dynamic Category Loading in Matrix
The matrix component MUST load its categories dynamically from the domain taxonomy configuration instead of relying on hardcoded constants.

#### Scenario: Dynamic matrix rendering
- **GIVEN** a domain taxonomy configuration loaded from `taxonomy.json`
- **WHEN** the Unified Coverage Matrix is rendered
- **THEN** the component SHALL dynamic-render categories specified in the configuration
- **AND** the columns MUST display the respective insurer data.
