# Spec: Audit Wizard

## Capability
Panel guía de auditoría que muestra discrepancias críticas pendientes, permite navegación directa a filas de la matriz, y visualiza progreso de validación.

## User Story
**Como** analista técnico de seguros
**Quiero** ver un resumen de las discrepancias que requieren mi atención
**Para** priorizar mi trabajo y asegurar que no omito validaciones críticas

## ADDED Requirements

### Requirement: Panel de tareas críticas
El sistema SHALL mostrar un panel en la parte superior de la pestaña de auditoría con un resumen de inconsistencias detectadas.

#### Scenario: Resumen de discrepancias
- **WHEN** el usuario abre la pestaña "Auditoría"
- **THEN** se muestra un panel con el conteo de:
  - Discrepancias de consenso (doble agente)
  - Alertas de cobertura inversa
  - Coberturas con confianza baja (<0.7)
- **AND** cada conteo es clicable para navegar a la sección correspondiente

#### Scenario: Mensaje personalizado
- **WHEN** hay discrepancias pendientes
- **THEN** el panel muestra un mensaje como:
  "Hola [Nombre], hemos detectado 2 discrepancias de consenso y 1 alerta de cobertura inversa."
- **AND** el mensaje se actualiza dinámicamente al resolver discrepancias

#### Scenario: Sin discrepancias
- **WHEN** no hay discrepancias pendientes
- **THEN** el panel muestra un check verde y mensaje:
  "Todas las coberturas han sido validadas. El análisis está listo para exportar."

### Requirement: Navegación de un clic a discrepancias
El panel SHALL permitir navegar directamente a la fila específica de la matriz donde ocurre una discrepancia.

#### Scenario: Navegación a fila
- **WHEN** el usuario hace clic en una discrepancia del panel
- **THEN** la vista se desplaza suavemente (scrollIntoView) hasta la fila correspondiente
- **AND** la fila se resalta temporalmente con fondo amarillo durante 2 segundos
- **AND** se abre automáticamente el dropdown de corrección de esa celda

#### Scenario: Fila no visible
- **WHEN** la fila está en otra pestaña (ej. "Coberturas")
- **THEN** el sistema cambia automáticamente a la pestaña correcta
- **AND** luego realiza el scroll y resaltado

### Requirement: Indicador de progreso circular
El sistema SHALL mostrar un indicador de progreso que refleje el avance de la auditoría.

#### Scenario: Progreso inicial
- **WHEN** hay discrepancias sin resolver
- **THEN** el indicador muestra el porcentaje de discrepancias resueltas
- **AND** se actualiza en tiempo real al resolver cada una

#### Scenario: Progreso completo
- **WHEN** todas las discrepancias han sido resueltas
- **THEN** el indicador muestra 100%
- **AND** cambia a color verde con animación de celebración

#### Scenario: Accesibilidad del progreso
- **WHEN** un screen reader lee el indicador
- **THEN** anuncia "Progreso de auditoría: X de Y alertas resueltas, Z por ciento"
- **AND** usa role="progressbar" con aria-valuenow, aria-valuemin, aria-valuemax

### Requirement: Accesos rápidos por tipo de alerta
El panel SHALL agrupar discrepancias por tipo para facilitar la priorización.

#### Scenario: Agrupación por severidad
- **WHEN** hay múltiples tipos de alertas
- **THEN** se muestran secciones colapsables:
  - Críticas (coberturas inversas, exclusiones graves)
  - Advertencias (discrepancias de consenso)
  - Informativas (matches de baja confianza)

#### Scenario: Orden por prioridad
- **WHEN** se muestran las alertas
- **THEN** están ordenadas por severidad (críticas primero)
- **AND** dentro de cada severidad, por orden de aparición en la matriz

## Dependencies
- Componente AuditSection
- Datos de discrepancias del backend (inverseCoverageChecker, coverageOntology)
- Componente UnifiedCoverageMatrix (navegación y scroll)
