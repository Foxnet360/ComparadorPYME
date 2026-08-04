## ADDED Requirements

### Requirement: Retroalimentación clara de selección obligatoria de cliente
El sistema DEBE mostrar un mensaje interactivo e indicador visual explícito que le señale al usuario la necesidad de seleccionar un cliente antes de intentar arrastrar o seleccionar cotizaciones.

#### Scenario: Intento de interacción sin cliente seleccionado
- **WHEN** el usuario se ubica en la pantalla de auditoría sin haber seleccionado un cliente
- **THEN** la zona de carga de archivos muestra una banner promocional y sugerencia con un enlace directo o botón que enfoca la selección/creación de cliente.
