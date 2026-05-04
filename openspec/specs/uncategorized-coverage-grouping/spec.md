## ADDED Requirements

### Requirement: Coberturas no categorizadas se agrupan por similitud semántica
Las coberturas no categorizadas DEBEN agruparse visualmente por su `canonicalName` sugerido (del tesauro) o mostrarse bajo "Sin clasificar" si no tienen canonicalName.

#### Scenario: Agrupación por canonicalName
- **WHEN** hay coberturas no categorizadas con canonicalName = "Responsabilidad Civil"
- **THEN** se agrupan visualmente bajo el título "Sugerido: Responsabilidad Civil"

#### Scenario: Coberturas sin canonicalName
- **WHEN** hay coberturas no categorizadas sin canonicalName
- **THEN** se muestran bajo el título "Sin clasificar"

#### Scenario: Mostrar confianza del match
- **WHEN** se muestra una cobertura agrupada
- **THEN** se muestra el matchConfidence como badge (verde >90%, amarillo 70-90%, rojo <70%)

### Requirement: Vista comparativa matriz para coberturas no categorizadas
El sistema DEBE permitir alternar entre vista agrupada y vista matriz (columnas = aseguradoras, filas = coberturas).

#### Scenario: Toggle de vistas
- **WHEN** el usuario hace clic en "Vista Matriz"
- **THEN** las coberturas no categorizadas se reorganizan en formato tabla comparativa

#### Scenario: Vista matriz muestra valores lado a lado
- **WHEN** se muestra la vista matriz
- **THEN** cada fila muestra el nombre de la cobertura y los valores de cada aseguradora en columnas

### Requirement: Información de mapeo visible
El sistema DEBE mostrar información sobre por qué una cobertura no se categorizó automáticamente.

#### Scenario: Mostrar método de matching
- **WHEN** se muestra una cobertura no categorizada
- **THEN** se indica el método de matching (tesauro, fuzzy, embedding, llm)

#### Scenario: Mostrar nombre original vs canónico
- **WHEN** el nombre original difiere del canónico
- **THEN** se muestra ambos: "Nombre original → Nombre canónico"
