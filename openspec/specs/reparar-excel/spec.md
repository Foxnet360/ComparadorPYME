## ADDED Requirements

### Requirement: Export matrix with notes
The system SHALL allow users to export the coverage matrix to Excel, including any consultive notes.

#### Scenario: Successful export with cell notes
- **WHEN** the user triggers the Excel export with cell notes present in the workspace
- **THEN** the system SHALL download a valid .xlsx file containing the notes in the "Insights del Consultor" column

### Requirement: Robust ratio formatting
The backend Excel generator SHALL format percentage ratios defensively.

#### Scenario: Format ratio with string check
- **WHEN** formatting cells representing ratio values in the Primas y Costos sheet
- **THEN** the system MUST verify that the value is a string before calling text replace methods to prevent runtime type errors
