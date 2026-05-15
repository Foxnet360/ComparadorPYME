## MODIFIED Requirements

### Requirement: Cálculo de deducible real
El sistema DEBE calcular el monto real del deducible basado en el valor asegurado y las condiciones del clausulado.

#### Scenario: Deducible con tope máximo
- **WHEN** el clausulado establece "10% / Mín. 2 SMMLV / Máx. 500 SMMLV"
- **AND** el valor asegurado es $5.000.000.000
- **THEN** el deducible real es el mínimo entre: 10% de $5B ($500M) y tope de 500 SMMLV (~$650M)
- **AND** el deducible efectivo es $500M (porque es menor que el tope)
- **AND** se registra que el tope NO fue aplicado (deducible natural < tope)

#### Scenario: Deducible sin tope
- **WHEN** el clausulado establece "15% sobre valor asegurado"
- **AND** el valor asegurado es $10.000.000.000
- **THEN** el deducible real es $1.500.000.000
- **AND** se genera alerta **WARNING**: "Deducible sin tope máximo representa 15% del valor asegurado"
- **AND** se sugiere: "Solicitar tope máximo para limitar exposición en siniestros grandes"

#### Scenario: Deducible con tope aplicado
- **WHEN** el clausulado establece "20% / Máx. 100 SMMLV"
- **AND** el valor asegurado es $10.000.000.000
- **THEN** el 20% sería $2.000.000.000
- **AND** el tope es 100 SMMLV (~$130.000.000)
- **AND** el deducible efectivo es $130.000.000 (tope aplicado)
- **AND** se genera alerta **INFO**: "Tope de deducible aplicado: $130M en lugar de $2B (20%)"

### Requirement: Proporción de riesgo
El sistema DEBE calcular la proporción del deducible respecto al valor asegurado y clasificar el riesgo.

#### Scenario: Riesgo bajo
- **WHEN** el deducible representa menos del 10% del valor asegurado
- **THEN** riesgo = **LOW**
- **AND** score de deductibles = 80-100

#### Scenario: Riesgo medio
- **WHEN** el deducible representa entre 10% y 15% del valor asegurado
- **THEN** riesgo = **MEDIUM**
- **AND** score de deductibles = 50-79

#### Scenario: Riesgo alto
- **WHEN** el deducible representa más del 15% del valor asegurado
- **THEN** riesgo = **HIGH**
- **AND** score de deductibles = 0-49

### Requirement: Comparativa de deducibles
El sistema DEBE permitir comparar deducibles entre aseguradoras considerando el valor real (no solo el porcentaje).

#### Scenario: Comparativa con valores diferentes
- **WHEN** Aseguradora A ofrece "10% / Máx. 300 SMMLV" sobre $5B
- **AND** Aseguradora B ofrece "15% / Sin tope" sobre $3B
- **THEN** se muestra:
  - A: Deducible real = $300M (6% del valor) | Tope aplicado
  - B: Deducible real = $450M (15% del valor) | Sin tope

## ADDED Requirements

### Requirement: Sublimit impact on deductible calculation
El sistema DEBE considerar sublímites de cobertura al calcular el riesgo total.

#### Scenario: Coverage with low sublimit
- **WHEN** Incendio tiene valor asegurado de $500M
- **AND** sublímite por evento es $100M
- **THEN** el análisis muestra: "ALERTA: Sublímite por evento ($100M) es 20% del valor asegurado"
- **AND** el riesgo se clasifica como HIGH independientemente del deducible

#### Scenario: Aggregate limit warning
- **WHEN** la suma de valores asegurados excede el límite agregado de la póliza
- **THEN** se genera alerta **CRITICAL**: "Exposición total ($X) excede límite agregado ($Y)"
- **AND** se recomienda: "Solicitar aumento de límite agregado o cobertura adicional"

### Requirement: Cap tracking and display
El sistema DEBE rastrear y mostrar explícitamente los topes aplicados a deducibles.

#### Scenario: Display cap information
- **WHEN** un deducible tiene tope máximo
- **THEN** el análisis muestra:
  - Deducible nominal: 20%
  - Tope máximo: 500 SMMLV (~$650M)
  - Deducible efectivo: $500M (porque 20% de $2.5B = $500M < tope)
  - Tope aplicado: No

#### Scenario: Cap applied
- **WHEN** un deducible tiene tope máximo que se aplica
- **THEN** el análisis muestra:
  - Deducible nominal: 20%
  - Valor sin tope: $2.000M
  - Tope máximo: 100 SMMLV (~$130M)
  - Deducible efectivo: $130M
  - Tope aplicado: Sí (ahorro de $1.870M vs deducible nominal)
  - Score mejora por aplicación de tope
