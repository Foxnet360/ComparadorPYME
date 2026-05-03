## Why

El formato actual de moneda y porcentaje no contempla correctamente las separaciones decimales según el estándar colombiano (punto para miles, coma para decimales). Se requiere estandarizar el formato en toda la aplicación para que valores como $1.234.567,89 y porcentajes como 12,5% se muestren correctamente en todos los componentes y reportes.

## What Changes

- Actualizar `formatCOP` para manejar correctamente separaciones de miles, cientos de miles, millones y miles de millones
- Crear nueva función `formatPercentage` con formato colombiano (coma para decimales)
- Reemplazar todos los usos directos de `.toFixed()` para porcentajes con `formatPercentage`
- Sincronizar implementaciones entre cliente (`utils/formatCurrency.ts`) y servidor (`server/src/utils/formatCurrency.ts`)
- Actualizar componentes UI que muestran porcentajes (UnifiedCoverageMatrix, gráficos, tablas)

## Capabilities

### New Capabilities
- `currency-formatting`: Formato estandarizado de moneda COP con separadores colombianos
- `percentage-formatting`: Formato estandarizado de porcentajes con separador decimal colombiano

### Modified Capabilities
- None

## Impact

- Componentes frontend: ComparisonReport, TechnicalDashboard, UnifiedCoverageMatrix, DeductiblesComparisonTable
- Servicios backend: narrativeService, analysisController
- Utilidades: utils/formatCurrency.ts, server/src/utils/formatCurrency.ts
- Reportes PDF: pdfService
