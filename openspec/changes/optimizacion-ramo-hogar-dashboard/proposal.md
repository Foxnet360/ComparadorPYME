# Proposal: Optimización Integral del Ramo Hogar, Matriz de Coberturas y Dashboard de Brechas

## Intent
Corregir los fallos visuales y de extracción detectados durante las pruebas con cotizaciones de Hogar (Allianz, SBS, SURA), adaptar el motor unificado a la tipología específica de seguros de hogar (Edificio, Contenido, Integral), homogeneizar los conceptos de negocio y revalorizar la sección de auditoría rebautizándola como "Análisis de Letra Chica y Brechas".

## Scope
1. **Visualización de Gráficos Recharts:**
   - Reincorporar `<ResponsiveContainer width="100%" height="100%">` dentro de `<DeferredChart>` en `ReportCharts.tsx` (Radar Cualitativo y Comparativa de Primas) y `AuditDashboard.tsx` (Distribución de Riesgos por Aseguradora) para eliminar las pantallas en blanco causadas por renderizado 0x0.
2. **Aislamiento Estricto del Nombre Corporativo de Aseguradoras:**
   - Actualizar el prompt V2 para prohibir la concatenación de cliente o producto en el array `insurers`.
   - Implementar sanitizador backend para normalizar nombres a razones sociales corporativas (`ALLIANZ`, `SURA`, `SBS`, `MAPFRE`, etc.) tanto desde nombres de archivo como desde la respuesta del LLM.
3. **Soporte Nativo de Dominio Hogar y Resolución de Amparos Porcentuales (SURA):**
   - Implementar y registrar `hogarPromptStrategy.ts` en `promptStrategyFactory.ts` usando la taxonomía de `data/domains/hogar/taxonomy.json`.
   - Enviar `domain` a `comparisonPromptBuilder.ts` para que use secciones y amparos residenciales (Edificio, Contenidos, RCE Familiar, Terremoto, Hurto, Asistencias) en lugar de PYME.
   - Instruir al modelo para cruzar los porcentajes (ej. "100%" en SURA) con el valor de Edificio/Contenido y mostrar el valor monetario real (ej. "$250.000.000 (100%)").
4. **Mecánica de Deducibles y Tipología Residencial:**
   - Reconocer las 3 modalidades de cotización: Solo Edificio, Solo Contenidos, Edificio + Contenidos.
   - Reglas de extracción para deducibles típicos en Colombia (% valor asegurable / % pérdida con mínimo en SMMLV).
5. **Homogeneización Semántica de Calificación:**
   - Estandarizar "No Cotizado" (bien no incluido en el alcance), "No Incluido" (amparo opcional no contratado) y "Sin Deducible" (copago $0, calificado como ventaja para el asegurado).
6. **Revalorización y Desbloqueo de Auditoría ("Análisis de Letra Chica y Brechas"):**
   - Eliminar el hardcode `isRagAvailable: false` en `analysisController.ts:958` para permitir la consulta a la base de clausulados cuando existan.
   - Renombrar la sección en UI a "Análisis de Letra Chica y Brechas" con una tarjeta de valor que resalte exclusiones ocultas y vacíos de cobertura.

## Impact
- Visualizaciones completas y reactivas en el Dashboard Resumen.
- Extracción precisa y legible para pólizas residenciales colombianas sin nombres distorsionados ni celdas en "100%".
- Claridad conceptual absoluta para corredores y clientes finales al comparar cotizaciones de hogar.
- Desbloqueo del análisis de clausulados RAG en el motor unificado.
