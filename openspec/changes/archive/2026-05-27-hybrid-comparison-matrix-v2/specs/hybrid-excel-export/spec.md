# Spec: Hybrid Excel Export

## Capability
Servicio determinista que compila el array unificado de filas de matriz (`MatrixRow[]`) y lo exporta a un libro Excel (.xlsx) estructurado en 3 pestañas (Portada, Coberturas, Primas) con estilo minimalista monocromático.

## ADDED Requirements

### Requirement: Monochromatic styled multi-tab excel workbook
The system SHALL generate an Excel file with exactly 3 worksheets styled in monochrome blue, gray, and white, with gridlines turned off.

#### Scenario: Excel workbook structure
- **WHEN** a user triggers the Excel export endpoint for a comparison
- **THEN** the system SHALL return a `.xlsx` file with worksheets named: 'Portada', 'Coberturas y Deducibles', and 'Primas y Costos'
- **AND** gridlines SHALL be hidden on the sheets
- **AND** the header rows SHALL be styled in dark gray (#333333) with white bold text

#### Scenario: Portada worksheet contents
- **WHEN** the 'Portada' sheet is generated
- **THEN** it SHALL include a clean title, insurer list, client profile details, total value of assets, and a navigability guide index

### Requirement: Deterministic cell formatting in Coberturas y Deducibles
The system SHALL loop over the unifed `MatrixRow[]` layout and apply formatting (bold fonts, text wrap, currency formatting, cell background fills) based on the row type.

#### Scenario: Formatting headers and data in Excel
- **WHEN** writing a `MatrixRow` of type 'header' to the sheet
- **THEN** the system SHALL merge cells A to N+1
- **AND** apply a light-blue fill (#E6F0FA)
- **AND** set the font to bold blue (#0066CC)

#### Scenario: Formatting currency values
- **WHEN** writing a row labeled 'Valor Asegurado' or 'Prima Neta'
- **THEN** numeric cell values SHALL be formatted in native Excel currency format ($#,##0)
- **AND** aligned to the right

#### Scenario: Handling exclusions and missing items
- **WHEN** an insurer does not offer a coverage in a row
- **THEN** the cell value SHALL be written as 'No incluida' / 'N.C.'
- **AND** formatted in soft gray text and italicized

### Requirement: Cell comments for auditable page tracking
The system SHALL preserve the trazabilidad of data by injecting original PDF source page numbers into the Excel cell metadata as comments.

#### Scenario: Cell comment injection
- **WHEN** a cell has an associated `pageNumber` in its source metadata
- **THEN** the system SHALL inject an Excel cell comment stating: "Fuente original: PDF cotización, Página N"
