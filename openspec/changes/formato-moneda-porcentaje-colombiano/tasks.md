## 1. Actualizar utilidades de formato (cliente)

- [ ] 1.1 Agregar función `formatPercentage` en `utils/formatCurrency.ts`
- [ ] 1.2 Verificar que `formatCOP` maneje correctamente todos los rangos de valores
- [ ] 1.3 Agregar función `formatNumber` si no existe (para consistencia con servidor)

## 2. Actualizar utilidades de formato (servidor)

- [ ] 2.1 Agregar función `formatPercentage` en `server/src/utils/formatCurrency.ts`
- [ ] 2.2 Verificar que `formatCOP` maneje correctamente todos los rangos de valores
- [ ] 2.3 Sincronizar funciones con versión del cliente

## 3. Actualizar componentes frontend

- [ ] 3.1 Reemplazar `.toFixed()` por `formatPercentage` en `UnifiedCoverageMatrix.tsx`
- [ ] 3.2 Reemplazar `.toFixed()` por `formatPercentage` en `DeductiblesComparisonTable.tsx`
- [ ] 3.3 Verificar otros componentes que usen porcentajes

## 4. Actualizar servicios y utilidades del servidor

- [ ] 4.1 Buscar y reemplazar `.toFixed()` para porcentajes en servicios
- [ ] 4.2 Verificar que `narrativeService` use formato correcto
- [ ] 4.3 Verificar que `analysisController` use formato correcto

## 5. Verificación

- [ ] 5.1 Ejecutar build del cliente: `npm run build`
- [ ] 5.2 Ejecutar tests si existen
- [ ] 5.3 Verificar visualmente formatos en UI
- [ ] 5.4 Verificar que PDFs generados usen formato correcto
