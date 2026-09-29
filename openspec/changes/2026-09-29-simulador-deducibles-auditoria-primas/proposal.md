# Proposal: Simulador Interactivo de Deducibles y Auditoría Contable de Primas

## Intent
Implementar la Fase 1 del Plan Integral de Modernización del comparador:
1. **Auditoría Contable de Primas**: Validar automáticamente la consistencia financiera de cada cotización analizada ($\text{Prima Neta} + \text{Gastos Expedición} + \text{IVA 19\%} = \text{Total a Pagar}$) emitiendo advertencias de auditoría explicativas si existen discrepancias (estampillas departamentales, retenciones o cargos de asistencia no desglosados).
2. **Simulador Interactivo de Siniestros (Deducibles)**: Incorporar un motor de cálculo y componente visual interactivo en el reporte comparativo que permita a los corredores simular pérdidas hipotéticas (\$10M, \$50M, \$100M COP) y visualizar con exactitud cuánto asume el cliente vs. cuánto indemniza cada aseguradora según los deducibles compuestos (% de pérdida con mínimos y topes en SMMLV).

## Scope
1. **Auditoría de Primas en Backend (`server/src/services/financialAudit/premiumAuditor.ts`):**
   - Servicio puro de auditoría que verifica la igualdad contable con tolerancia a redondeos ($\le \$1.000\text{ COP}$).
   - Generación de `AlertItem` de nivel `INFO` o `WARNING` integrado en el pipeline de reconciliación/reporte.
2. **Motor de Simulación de Siniestros (`server/src/services/claimSimulatorService.ts`):**
   - Soporte para deducibles porcentuales con mínimos y máximos en SMMLV (`SMMLV_VALUE` del entorno) y deducibles fijos en COP.
   - Cálculo determinístico de deducible liquidado e indemnización neta por aseguradora y amparo.
3. **Control por Feature Flags (`server/src/config/featureFlags.ts`):**
   - `enablePremiumEquationAudit`: activa la emisión de alertas contables.
   - `enableClaimDeductibleSimulator`: expone la simulación en el backend y el panel en frontend.
4. **Capa Visual Frontend (`components/report/ClaimSimulatorPanel.tsx`):**
   - Control interactivo tipo slider de monto de pérdida reclamada.
   - Visualización comparativa tabular y gráfica de desembolso por aseguradora.
   - Integración no destructiva en `components/ComparisonReport.tsx`.

## Rollback Plan
- Desactivar las variables de entorno `ENABLE_PREMIUM_EQUATION_AUDIT=false` y `ENABLE_CLAIM_DEDUCTIBLE_SIMULATOR=false`.
- Sin impacto en base de datos ni migraciones requeridas: los datos base de cotizaciones se mantienen idénticos.

## Impact
- Corredores equipados con un argumento de venta dinámico para clientes PYME.
- Prevención de errores contables en presentaciones comerciales a clientes.
- Cero regresión en reportes antiguos (`schemaVersion: 1, 2, 3`).
