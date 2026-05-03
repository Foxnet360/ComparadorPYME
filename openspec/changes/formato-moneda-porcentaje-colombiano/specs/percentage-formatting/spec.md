## ADDED Requirements

### Requirement: Formato de porcentaje estándar
El sistema DEBE formatear valores de porcentaje usando coma (,) como separador decimal según el estándar colombiano.

#### Scenario: Porcentaje entero
- **WHEN** se formatea el valor 25
- **THEN** el resultado debe ser "25%"

#### Scenario: Porcentaje con decimal
- **WHEN** se formatea el valor 12.5
- **THEN** el resultado debe ser "12,5%"

#### Scenario: Porcentaje con múltiples decimales
- **WHEN** se formatea el valor 12.345 con 2 decimales
- **THEN** el resultado debe ser "12,35%"

#### Scenario: Porcentaje de confianza
- **WHEN** se formatea el valor 0.876 como porcentaje con 0 decimales
- **THEN** el resultado debe ser "88%"

#### Scenario: Valor nulo o indefinido
- **WHEN** se intenta formatear un valor null o undefined
- **THEN** el resultado debe ser "0%"
