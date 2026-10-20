# Tasks: Simulador Interactivo de Deducibles y Auditoría Contable de Primas

## Phase 1: Feature Flags y Modelos Base
- [x] 1.1 Registrar las banderas `enablePremiumEquationAudit` y `enableClaimDeductibleSimulator` en `server/src/config/featureFlags.ts` (con soporte para variables de entorno).
- [x] 1.2 Definir los tipos de datos de auditoría de primas y simulación de siniestro en `server/src/types/claimSimulation.ts`.

## Phase 2: Auditoría Contable de Primas
- [x] 2.1 Implementar `server/src/services/financialAudit/premiumAuditor.ts` con verificación de ecuación $\text{Prima Neta} + \text{Gastos} + \text{IVA} = \text{Total}$.
- [x] 2.2 Crear suite de pruebas unitarias `server/src/services/financialAudit/__tests__/premiumAuditor.test.ts`.
- [x] 2.3 Integrar la llamada al auditor en el flujo de reporte o análisis protegiéndola con `featureFlags.enablePremiumEquationAudit`.

## Phase 3: Motor de Simulación de Siniestros
- [x] 3.1 Implementar `server/src/services/claimSimulatorService.ts` resolviendo deducibles porcentuales con mínimos y máximos en SMMLV.
- [x] 3.2 Crear suite de pruebas unitarias `server/src/services/__tests__/claimSimulatorService.test.ts`.
- [x] 3.3 Exponer la utilidad de cálculo compartible en frontend/backend.

## Phase 4: Capa de Presentación Frontend
- [x] 4.1 Crear el componente `components/report/ClaimSimulatorPanel.tsx` con slider interactivo de pérdida y gráfico/tabla comparativa de desembolso.
- [x] 4.2 Integrar `ClaimSimulatorPanel` en `components/ComparisonReport.tsx` condicionado a `featureFlags.enableClaimDeductibleSimulator`.
- [x] 4.3 Añadir pruebas de renderizado e interacción para `ClaimSimulatorPanel`.

## Phase 5: Verificación y Cierre
- [x] 5.1 Ejecutar `npm run typecheck:frontend` y `npm run typecheck:backend`.
- [x] 5.2 Ejecutar suite de pruebas con `npm test`.
- [x] 5.3 Registrar avance en Engram y documentar métricas de la fase.
