# Proposal: Exportar Comparación a Excel

## Why
El analista técnico requiere exportar el reporte comparativo de pólizas a un libro de Excel (.xlsx) altamente enriquecido con 5 pestañas especializadas (Portada y Resumen General, Matriz Coberturas, Matriz Deducibles, Primas y Costos, Análisis de Riesgos), garantizando paridad total con la auditoría web y diseño ejecutivo de nivel software.

## What
- Implementar la descarga del reporte comparativo completo en formato Excel (.xlsx).
- Estructurar 5 pestañas independientes:
  1. `Portada y Resumen General`: Portada ejecutiva, datos de cliente y corredor, dictamen sombreado de recomendación, scorecard 0-100 por dimensión y guía de navegación.
  2. `Matriz Coberturas`: Matriz ampliada organizada por secciones (`BIENES ASEGURADOS`, `COBERTURAS`, `SUSTRACCIÓN`, `AMPAROS EXCLUSIVOS`), formato RAG semáforo y notas de cita de PDF.
  3. `Matriz Deducibles`: Matriz consolidada dedicada a deducibles por amparo con enriquecimiento monetario en COP y resaltado de "Sin Deducible / No Aplica".
  4. `Primas y Costos`: Desglose financiero con fórmulas automáticas nativas (`SUM`, `ROUND`, `MIN`, `% sobre Valor Asegurado`) e indicador gráfico visual de costo relativo.
  5. `Análisis de Riesgos`: Fortalezas, debilidades, escala de calificación 1 a 10 con gradiente de color y tabla de alertas auditadas.
- Utilizar la matriz de verdad absoluta (`MatrixRow[]`) para paridad 100% con los datos de la interfaz Web.

## Rollback Plan
Si ocurren fallos en la generación del buffer binario, el endpoint responde con HTTP 500 y la UI muestra una notificación toast sin interrumpir la navegación del usuario en la pantalla web.
