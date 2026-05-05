## Delta Spec

### Requirement: Clausulados obligatorios en scoring

El sistema DEBE penalizar la ausencia de clausulados en lugar de asignar un score neutral.

#### Scenario: Sin clausulado disponible
- **WHEN** no hay clausulado indexado para una aseguradora
- **THEN** las dimensiones que dependen del clausulado scorean 30/100 (no 50/100)
- **AND** se muestra advertencia: "Análisis sin validación de clausulado"

### Requirement: Validación de existencia de coberturas

El scoring DEBE considerar si las coberturas en la cotización existen en el clausulado.

#### Scenario: Cobertura fantasma detectada
- **WHEN** se detecta una cobertura en cotización que no existe en clausulado
- **THEN** el score de coverage se reduce en 15 puntos por cobertura fantasma

#### Scenario: Cobertura obligatoria omitida
- **WHEN** el clausulado establece una cobertura como obligatoria pero la cotización la omite
- **THEN** el score de coverage se reduce en 10 puntos por cobertura omitida

### Requirement: Score mínimo ajustado

El score de coverage DEBE considerar validación del clausulado.

#### Scenario: Score ajustado
- **WHEN** base coverage score = 70
- **AND** se detectan 2 coberturas fantasmas
- **THEN** score final = max(0, 70 - 30) = 40

### Modified Scoring Formula

```
Cobertura Base = (coberturas presentes / coberturas esperadas) × 100
Penalización Fantasmas = fantasmas × 15
Penalización Omitidas = omitidas obligatorias × 10
Score Coverage = max(0, Cobertura Base - Penalización Fantasmas - Penalización Omitidas)
```
