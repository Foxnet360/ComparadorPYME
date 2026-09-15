# Tasks: Optimización del Ramo Hogar, Matriz de Coberturas y Dashboard de Brechas

## Phase 1: Corrección de Visualización de Gráficos Recharts
- [ ] 1.1 Envolver los gráficos Recharts (`RadarChart` y `BarChart`) en `<ResponsiveContainer width="100%" height="100%">` dentro de `DeferredChart` en `components/report/ReportCharts.tsx`.
- [ ] 1.2 Envolver `BarChart` en `<ResponsiveContainer width="100%" height="100%">` dentro de `DeferredChart` en `components/AuditDashboard.tsx`.
- [ ] 1.3 Verificar que ambos componentes compilen y monten correctamente con dimensiones válidas.

## Phase 2: Aislamiento Corporativo de Aseguradoras y Limpieza de Cabeceras
- [ ] 2.1 Implementar función utilitaria de sanitización de nombres de aseguradoras (`extractCanonicalInsurerName`) para remover sufijos de cliente y ramo.
- [ ] 2.2 Aplicar la sanitización en `analysisController.ts` y `matrixTransformer.ts`.
- [ ] 2.3 Reforzar el prompt en `comparisonPromptBuilder.ts` con directivas estrictas que prohíban concatenar cliente o ramo en el array `insurers`.

## Phase 3: Estrategia Dedicada para Hogar y Resolución de Amparos Porcentuales
- [ ] 3.1 Crear `server/src/services/unifiedComparison/hogarPromptStrategy.ts` con secciones residenciales y registrarlo en `promptStrategyFactory.ts`.
- [ ] 3.2 Pasar `domain` a `comparisonPromptBuilder.ts` para que `buildV2ComparisonPrompt` adopte las secciones y reglas de Hogar cuando `domain === 'hogar'`.
- [ ] 3.3 Agregar instrucción en el prompt para calcular y mostrar el monto en pesos cuando el amparo venga expresado en porcentaje (ej. SURA "100%").

## Phase 4: Deducibles, Tipología y Homogeneización Semántica
- [ ] 4.1 Incorporar en el prompt el análisis de tipología (Edificio, Contenidos, Edificio + Contenidos) y la extracción de deducibles residenciales colombianos.
- [ ] 4.2 Establecer y homogenizar las reglas semánticas de "No Cotizado" vs "No Incluido" vs "Sin Deducible" en el prompt y en la lógica de calificación/matriz.

## Phase 5: Activación de Clausulados y Rebranding a "Análisis de Letra Chica y Brechas"
- [ ] 5.1 En `analysisController.ts`, calcular dinámicamente `isRagAvailable` para que la sección de análisis consulte los clausulados indexados.
- [ ] 5.2 Renombrar en la UI "Auditoría de Riesgos" a "Análisis de Letra Chica y Brechas" en `components/AuditSection.tsx`, pestañas de navegación y títulos, destacando su valor de detección de vacíos y exclusiones ocultas.
- [ ] 5.3 Ejecutar suites de pruebas y verificación de tipos (TypeScript frontend y backend).
