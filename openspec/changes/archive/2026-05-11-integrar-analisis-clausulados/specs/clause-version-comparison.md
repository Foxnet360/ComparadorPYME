## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir información de versiones de clausulados en la respuesta del endpoint `/api/analyze` cuando se soliciten comparaciones.

#### Scenario: Información de versión incluida
- **WHEN** el sistema completa el análisis de una cotización
- **AND** se especifica un documento de clausulado para comparación
- **THEN** la respuesta JSON incluye información de la versión del clausulado

### Requirement: Comparación de versiones en UI
El sistema DEBE permitir comparar versiones de clausulados desde la interfaz de usuario.

#### Scenario: Selector de versiones
- **WHEN** el usuario accede a la pestaña "Análisis Avanzado"
- **AND** existen múltiples versiones del clausulado
- **THEN** se muestra un selector para elegir versiones a comparar

#### Scenario: Visualización de diferencias
- **WHEN** se seleccionan dos versiones para comparar
- **THEN** se muestran las diferencias en:
  - Coberturas agregadas/eliminadas
  - Cambios en deducibles
  - Exclusiones nuevas/eliminadas
  - Impacto positivo/negativo por cambio

## MODIFIED Requirements

### Requirement: Comparación de versiones de clausulados
El sistema DEBE comparar dos versiones de un clausulado y detectar cambios contractuales.

#### Scenario: Nueva cobertura agregada
- **WHEN** se compara una versión nueva vs una anterior
- **AND** la versión nueva tiene una cobertura adicional
- **THEN** se marca como cambio POSITIVO
- **AND** se incluye en la respuesta de `/api/analyze`

#### Scenario: Deducible aumentado
- **WHEN** se compara una versión nueva vs una anterior
- **AND** un deducible aumentó de 10% a 15%
- **THEN** se marca como cambio NEGATIVO
- **AND** se alerta al usuario
