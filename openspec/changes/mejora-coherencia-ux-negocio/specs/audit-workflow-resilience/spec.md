## ADDED Requirements

### Requirement: Persistir archivos e insumos ante fallos de análisis
El sistema DEBE mantener los archivos de cotizaciones (`quoteFiles`), los clausulados seleccionados/cargados (`clauseFiles` / `selectedClauseIds`) y el cliente seleccionado (`selectedClient`) cuando ocurra una falla durante la ejecución de la auditoría.

#### Scenario: Falla de red o API durante análisis
- **WHEN** la llamada a la función de análisis de cotizaciones arroje un error o excepción
- **THEN** el sistema debe cambiar el estado a `AppStatus.ERROR`, desplegar el mensaje de error y permitir un botón de reintento ("Reintentar auditoría") que conserve todos los archivos e insumos previamente cargados sin resetearlos a cero.

#### Scenario: Cancelación manual o reintento exitoso
- **WHEN** el usuario presiona "Reintentar auditoría" tras un error
- **THEN** el sistema debe volver a invocar el análisis conservando los archivos y estado de entrada originales.
