# Spec: Simulador Interactivo de Deducibles y Auditoría Contable de Primas

## Requirements

### Requirement 1: Auditoría Contable de Primas (Invariante Financiero)
The `server/src/services/financialAudit/premiumAuditor.ts` service MUST:
- Calculate the theoretical total payable as:
  $$\text{Expected Total} = \text{Net Premium} + \text{Expedition Fees} + \text{Taxes (IVA 19\%)}$$
- Compare `Expected Total` against `totalPayable` reported by the insurer.
- If the difference exceeds the configurable tolerance (default: \$1.000 COP), generate an `AlertItem` with level `WARNING` detailing the variance and plausible financial reasons (such as departmental stamps or third-party assistances).
- If the difference is zero or within tolerance, generate no warning or an `INFO` confirmation.
- Handle missing breakdown fields gracefully without throwing uncaught exceptions.

#### Scenario: Cotización con desglose exacto
- **GIVEN** a quote with Net Premium \$10.000.000, Expedition Fees \$100.000, Taxes \$1.919.000, and Total \$12.019.000
- **WHEN** the quote is evaluated by `auditPremiumEquation`
- **THEN** it SHALL return `isValid: true` and no discrepancy alert.

#### Scenario: Cotización con estampillas departamentales no desglosadas
- **GIVEN** a quote where Net + Fees + IVA equals \$12.019.000 but Total is \$12.150.000 (difference of \$131.000)
- **WHEN** the quote is evaluated by `auditPremiumEquation`
- **THEN** it MUST return `isValid: false`, `discrepancy: 131000`, and an alert detailing the variance.

#### Scenario: Cotización con prima incompleta o no extraída
- **GIVEN** a quote where `totalPayable` is 0 or null
- **WHEN** the quote is evaluated by `auditPremiumEquation`
- **THEN** it MUST NOT crash and SHALL return `skipped: true`.

---

### Requirement 2: Motor de Simulación de Siniestros (Claim Simulation Engine)
The `server/src/services/claimSimulatorService.ts` service MUST:
- Accept a claim amount $L$ in COP and a list of insurer deductible structures or raw deductible texts.
- Resolve any minimum or maximum amounts expressed in `SMMLV` to COP using the canonical `SMMLV_VALUE` from `domainConstants.ts`.
- Calculate the payable deductible as:
  $$\text{Deductible Base} = L \times \frac{\text{percentage}}{100}$$
  $$\text{Payable Deductible} = \min(\max(\text{Deductible Base}, \text{minAmount}), \text{maxAmount})$$
  capped at the total claim loss $L$.
- Calculate the net indemnification as:
  $$\text{Net Indemnification} = \max(0, L - \text{Payable Deductible})$$
- Provide a ranking of options from lowest client out-of-pocket cost to highest.

#### Scenario: Simulación con deducible porcentual y mínimo en SMMLV
- **GIVEN** an insurer with deductible "10% de la pérdida, mín. 5 SMMLV" (SMMLV = \$1.423.500, min = \$7.117.500)
- **WHEN** a claim of \$50.000.000 COP is simulated
- **THEN** 10% is \$5.000.000, which is below the minimum; the Payable Deductible MUST be \$7.117.500 COP, and Net Indemnification MUST be \$42.882.500 COP.

#### Scenario: Simulación con deducible con tope máximo
- **GIVEN** an insurer with deductible "10% de la pérdida, mín. 5 SMMLV, máx. 15 SMMLV" (\$21.352.500)
- **WHEN** a claim of \$300.000.000 COP is simulated
- **THEN** 10% is \$30.000.000, which exceeds the maximum; the Payable Deductible MUST be capped at \$21.352.500 COP.

#### Scenario: Simulación con deducible exento / cero
- **GIVEN** an amparo without deductible ("Sin deducible")
- **WHEN** any claim amount is simulated
- **THEN** the Payable Deductible MUST be 0 and Net Indemnification MUST equal the full claim amount.

---

### Requirement 3: Componente Visual Interactivo en Frontend
The `components/report/ClaimSimulatorPanel.tsx` component MUST:
- Render within `ComparisonReport.tsx` only when `enableClaimDeductibleSimulator` is active and quotes contain deductible information.
- Provide presets for standard claim amounts (\$10M, \$50M, \$100M, \$250M COP) and an interactive slider/input.
- Display a clear comparative breakdown showing:
  - Aseguradora
  - Deducible asumido por el cliente
  - Monto efectivamente pagado por la aseguradora
  - Badge destacado para la opción más favorable para el cliente.
- Be accessible via keyboard and screen reader, matching existing design tokens.
