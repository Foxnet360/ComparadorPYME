## ADDED Requirements

### Requirement: Winner indicator por categoría
El sistema DEBE mostrar 🏆 en la mejor opción de cada categoría.

#### Scenario: Determinar winner
- **WHEN** hay múltiples aseguradoras para una categoría
- **THEN** evaluar: mayor suma asegurada, menor deducible, sin exclusión
- **AND** mostrar 🏆 en la celda ganadora

#### Scenario: Tooltip explicativo
- **WHEN** el usuario hace hover en 🏆
- **THEN** mostrar: "Mejor opción: mayor suma asegurada + menor deducible"

### Requirement: Diff highlighting
El sistema DEBE resaltar diferencias significativas entre aseguradoras.

#### Scenario: Diferencia significativa
- **WHEN** una aseguradora tiene valor < 70% del promedio
- **THEN** fondo rojo claro + delta "-30%"

#### Scenario: Valor destacado
- **WHEN** una aseguradora tiene valor > 130% del promedio
- **THEN** fondo verde claro + delta "+30%"

### Requirement: Toggle Cliente/Técnico
El sistema DEBE permitir cambiar entre vista simplificada y completa.

#### Scenario: Vista Cliente
- **WHEN** toggle está en "Cliente"
- **THEN** Matriz: solo valores y deducibles
- **AND** Auditoría: solo riesgos críticos
- **AND** Deducibles: solo severidad simple

#### Scenario: Vista Técnica
- **WHEN** toggle está en "Técnica"
- **THEN** muestra todo: confidence scores, match details, todos los hallazgos
