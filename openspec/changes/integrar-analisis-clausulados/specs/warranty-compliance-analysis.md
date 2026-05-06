## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir el análisis de cumplimiento de garantías en la respuesta del endpoint `/api/analyze`.

#### Scenario: Análisis de cumplimiento incluido en respuesta
- **WHEN** el sistema completa el análisis de una cotización
- **AND** la cotización tiene condiciones o garantías especiales
- **THEN** la respuesta JSON incluye el campo `warrantyCompliance` con el análisis de cumplimiento

#### Scenario: Condiciones analizadas por dificultad
- **WHEN** existen condiciones en la cotización
- **THEN** cada condición se clasifica por tipo (DOCUMENTAL, OPERACIONAL, TÉCNICO, FINANCIERO)
- **AND** se evalúa la dificultad (EASY, MEDIUM, HARD)
- **AND** se calcula el porcentaje de cumplimiento estimado

### Requirement: Visualización de cumplimiento de garantías
El sistema DEBE mostrar el dashboard de cumplimiento en la pestaña de análisis avanzado.

#### Scenario: Dashboard de cumplimiento visible
- **WHEN** el usuario accede a la pestaña "Análisis Avanzado"
- **AND** existen datos de `warrantyCompliance`
- **THEN** se muestra el dashboard con:
  - Total de condiciones
  - Distribución por tipo
  - Nivel de riesgo general (LOW/MEDIUM/HIGH)
  - Condiciones de alto riesgo destacadas

## MODIFIED Requirements

### Requirement: Clasificación de condiciones por dificultad
El sistema DEBE clasificar las condiciones de la póliza según su dificultad de cumplimiento.

#### Scenario: Condición financiera difícil para PYME pequeña
- **WHEN** una condición es de tipo FINANCIERO
- **AND** requiere fianza o constitución de garantía
- **AND** el cliente tiene ingresos anuales < $100M COP
- **THEN** la dificultad es HARD
- **AND** el riesgo de cumplimiento es HIGH
- **AND** se incluye en la respuesta de `/api/analyze`

#### Scenario: Condición técnica difícil para equipo pequeño
- **WHEN** una condición es de tipo TÉCNICO
- **AND** requiere certificaciones o mantenimiento especializado
- **AND** el cliente tiene <10 empleados
- **THEN** la dificultad es HARD
- **AND** se sugiere verificar capacidad técnica antes de aceptar
