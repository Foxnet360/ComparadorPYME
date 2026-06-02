## MODIFIED Requirements

### FR-1: Extracción de coberturas del clausulado

El sistema DEBE extraer todas las coberturas mencionadas en el clausulado, clasificándolas por obligatoriedad. Para ello, la consulta del clausulado de la aseguradora DEBE realizarse utilizando previamente el nombre normalizado/canónico de la aseguradora.

#### Scenario: Coberturas extraídas
- **WHEN** se procesa un clausulado para una aseguradora (ej. "SBS SEGUROS COLOMBIA S.A.")
- **AND** el sistema normaliza su nombre a "SBS" para obtener el clausulado indexado
- **THEN** se extraen exitosamente:
  - Coberturas obligatorias: Incendio, RC, Lucro Cesante
  - Coberturas opcionales: Transporte de Valores, Vidrios Planos

### FR-2: Verificación inversa

El sistema DEBE comparar las coberturas del clausulado contra las de la cotización, normalizando previamente el nombre de la aseguradora para realizar la búsqueda en la base de datos de clausulados.

#### Scenario: Cobertura obligatoria faltante
- **WHEN** el clausulado para el nombre normalizado "SBS" establece "Lucro Cesante" como obligatoria
- **AND** la cotización no la incluye
- **THEN** alerta **CRITICAL**: "Cobertura obligatoria omitida. El clausulado establece Lucro Cesante como cobertura mínima."

#### Scenario: Cobertura opcional faltante
- **WHEN** el clausulado para el nombre normalizado "SBS" menciona "Transporte de Valores" como opcional
- **AND** la cotización no la incluye
- **THEN** info: "Cobertura opcional no contratada"
