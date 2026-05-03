## Context

Actualmente la aplicación tiene funciones de formato de moneda (`formatCOP`, `formatCOPMillions`, `formatNumber`) en `utils/formatCurrency.ts` (cliente) y `server/src/utils/formatCurrency.ts` (servidor). Sin embargo, no existe una función estandarizada para formatear porcentajes, y en varios componentes se usa `.toFixed()` directamente, lo que produce formatos inconsistentes (punto como separador decimal en lugar de coma según el estándar colombiano).

## Goals / Non-Goals

**Goals:**
- Estandarizar formato de moneda COP con separadores correctos para todos los rangos de valores
- Crear función `formatPercentage` con separador decimal colombiano (coma)
- Reemplazar todos los usos directos de `.toFixed()` para porcentajes
- Mantener sincronizadas las utilidades de cliente y servidor

**Non-Goals:**
- Cambiar la lógica de cálculo de porcentajes o monedas
- Modificar el locale global de la aplicación
- Cambiar formatos de fecha u otros tipos de datos

## Decisions

1. **Usar `toLocaleString('es-CO')` vs implementación manual**
   - Decisión: Mantener `toLocaleString('es-CO')` para moneda, crear wrapper para porcentajes
   - Rationale: El API nativo ya maneja correctamente el formato colombiano

2. **Crear función `formatPercentage` separada**
   - Decisión: Función dedicada en lugar de extender `formatCOP`
   - Rationale: Semántica clara y reutilizable en toda la aplicación

3. **Sincronizar cliente y servidor**
   - Decisión: Mantener dos archivos separados pero idénticos
   - Rationale: Evitar dependencias cross-boundary, cada uno es self-contained

## Risks / Trade-offs

- [Riesgo] Algunos componentes de terceros (como Recharts) pueden no respetar el formato → [Mitigación] Usar formatters específicos del componente
- [Riesgo] Tests existentes pueden depender del formato actual → [Mitigación] Actualizar tests junto con la implementación
