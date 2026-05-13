## MODIFIED Requirements

### FR-1: Matriz de comparación unificada
El frontend SHALL renderizar la comparación de coberturas en una matriz de exactamente 14 filas fijas, una por cada categoría canónica de la Plantilla PYME, usando visualización compacta para deductibles.

#### Scenario: Cobertura presente con badge de deducible
- **WHEN** una cotización incluye una cobertura que mapea a una categoría
- **THEN** la celda muestra el valor asegurado
- **AND** el deducible se muestra como badge inline colorido (8px dot + texto), NO como gauge circular
- **AND** badge verde para "Sin deducible", amarillo para 1-10%, rojo para >10% o "No especificado"
- **AND** tooltip al hover muestra el deducible completo y recomendación

### FR-3: Sección de coberturas no categorizadas
El frontend SHALL mostrar coberturas que no pudieron mapearse a ninguna categoría en una sección separada con matriz verdadera N×M.

#### Scenario: Vista matriz con todas las aseguradoras
- **WHEN** el usuario selecciona vista "Matriz" en coberturas no categorizadas
- **THEN** se muestra una tabla con filas = coberturas únicas, columnas = todas las aseguradoras
- **AND** cada celda muestra el valor para esa cobertura/aseguradora
- **AND** si una aseguradora no tiene esa cobertura, muestra "—"

#### Scenario: Coberturas exclusivas destacadas
- **WHEN** una cobertura no categorizada solo existe en una aseguradora
- **THEN** se muestra badge "Exclusiva" en color índigo
- **AND** se resalta la fila con fondo índigo claro

## ADDED Requirements

### Requirement: Simplified deductible visualization
El sistema SHALL usar visualización compacta para deductibles en todas las vistas de cobertura.

#### Scenario: Badge inline en matriz principal
- **WHEN** se muestra una celda de cobertura con deducible
- **THEN** se muestra badge inline de una línea: "Ded: 10% [🟡]"
- **AND** NO se renderiza gauge circular SVG

#### Scenario: Badge en coberturas no categorizadas
- **WHEN** se muestra una cobertura no categorizada con deducible
- **THEN** se usa el mismo badge inline compacto
- **AND** el badge NO ocupa más de 24px de alto
