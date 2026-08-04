## ADDED Requirements

### Requirement: Gestión del selector de ramo en la barra principal
El sistema DEBE ubicar la selección de ramo (`pyme` vs `autos`) en la barra principal de configuración del análisis y garantizar que el dominio se reinicie por defecto a `pyme` o se sincronice según el contexto del cliente seleccionado al iniciar una nueva auditoría.

#### Scenario: Cambio de cliente o reinicio de auditoría
- **WHEN** el usuario inicia una nueva auditoría o selecciona un nuevo cliente
- **THEN** el selector de dominio se resetea al valor predeterminado del sistema (`pyme`) o al ramo habitual del cliente sin arrastrar silenciosamente la selección de una sesión anterior.
