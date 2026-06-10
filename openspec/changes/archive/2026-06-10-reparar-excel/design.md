## Context

La exportación a Excel falla debido a un error de tipo en el frontend al intentar desestructurar el hook `useCellNotes()` sin extraer la variable `cellNotes`, resultando en un valor `undefined` que causa una excepción fatal al invocar `Object.entries()`. 

Adicionalmente, el backend en `excelGenerator.ts` realiza operaciones de formateo de cadenas de texto en valores de tipo ratio sin validar si el valor es de tipo string, lo cual podría provocar excepciones `TypeError` imprevistas.

## Goals / Non-Goals

**Goals:**
- Asegurar que el estado `cellNotes` se extraiga correctamente en el componente `UnifiedCoverageMatrix`.
- Modificar el backend para validar el tipo de dato de la celda de ratio en la hoja de Primas y Costos antes de ejecutar manipulaciones de cadenas de texto.
- Lograr una descarga exitosa del archivo `.xlsx` en el navegador con paridad total de notas.

**Non-Goals:**
- Modificar el diseño, la lógica de agrupamiento o la estructura general del libro Excel.
- Rediseñar el almacenamiento de notas en Supabase.

## Decisions

### Decisión 1: Desestructurar `cellNotes` en el Frontend
* **Opción**: Modificar la línea de inicialización del hook de notas en `UnifiedCoverageMatrix.tsx` para destejer `cellNotes` junto a `setCellNote` y `getCellNote`.
* **Razón**: Es la forma directa y estándar de obtener el mapa de notas del contexto global de análisis de la aplicación.
* **Alternativas**: Consultar el contexto de forma manual. *Rechazada* por agregar complejidad innecesaria y romper el patrón de hooks del proyecto.

### Decisión 2: Validación defensiva de tipo string en `excelGenerator.ts`
* **Opción**: Validar si `typeof val === 'string'` antes de invocar los métodos `.replace` para formatear porcentajes de ratios.
* **Razón**: Si el valor no es un string (es decir, es nulo, indefinido, o ya ha sido pre-formateado como número), el sistema no lanzará una excepción fatal del servidor, garantizando alta tolerancia a fallos.

## Risks / Trade-offs

* **[Riesgo]** Si `cellNotes` contiene datos corruptos.
  * **Mitigación**: La lógica de exportación en el frontend mapea únicamente notas válidas (`if (note.content) exportNotes[key] = note.content`), filtrando cualquier entrada vacía o corrupta.
