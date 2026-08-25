# Spec: Normalización de Formatos y Caracteres

## Requirement: Parseo Robusto de Moneda (Dual Notación US / LatAm)
The currency parser MUST correctly parse both LatAm (`15.000.000,00`) and US/International (`15,000,000.00`) numeric representations without truncating values.

### Scenario: Parsing US formatted currency string
- **WHEN** parsing `$ 15,000,000.00`
- **THEN** it MUST return `15000000.0`
- **AND** it MUST NOT truncate to `15.0`.

### Scenario: Parsing LatAm formatted currency string
- **WHEN** parsing `$ 15.000.000,50`
- **THEN** it MUST return `15000000.5`.

## Requirement: Sanitización Mojibake de Caracteres Especiales
The system MUST repair double-encoded UTF-8 strings before returning analysis API responses.

### Scenario: Repairing corrupted UTF-8 string
- **WHEN** encountering text containing `pÃ©rdida`, `daÃ±o`, `pÃ³liza`
- **THEN** it MUST sanitize the text to `pérdida`, `daño`, `póliza`.
