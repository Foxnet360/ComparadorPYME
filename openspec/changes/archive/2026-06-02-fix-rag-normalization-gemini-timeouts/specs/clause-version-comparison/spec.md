## MODIFIED Requirements

### FR-1: Detección de cambios

El sistema DEBE comparar dos versiones de un clausulado y detectar diferencias. Para obtener el historial de versiones del clausulado de la aseguradora, el sistema DEBE normalizar previamente el nombre de la aseguradora.

#### Scenario: Cambio en deducible
- **WHEN** se compara v2023 vs v2024 para la aseguradora "SBS SEGUROS COLOMBIA S.A."
- **AND** el sistema normaliza su nombre a "SBS" para consultar sus versiones
- **AND** v2023: "Deducible terremoto: 10%"
- **AND** v2024: "Deducible terremoto: 15%"
- **THEN** se detecta cambio: "Deducible terremoto aumentó de 10% a 15%"
- **AND** impacto: **NEGATIVO para el asegurado**

#### Scenario: Nueva exclusión
- **WHEN** v2024 para la aseguradora normalizada "SBS" agrega: "No cubre daños por construcción adyacente"
- **AND** v2023 no tenía esta exclusión
- **THEN** se detecta: "Nueva exclusión agregada en v2024"
- **AND** impacto: **NEGATIVO para el asegurado**
