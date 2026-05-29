# Spec: HITL Correction Workflow

## Capability
Flujo completo de corrección human-in-the-loop que conecta la interfaz de usuario con el backend de aprendizaje, incluyendo estado optimista, manejo de errores, y sincronización offline.

## User Story
**Como** analista técnico de seguros
**Quiero** corregir mapeos incorrectos de coberturas y saber que la corrección fue guardada
**Para** mejorar la precisión del sistema y mantener mi trabajo

## ADDED Requirements

### Requirement: Envío de corrección a API real
El frontend SHALL enviar correcciones al endpoint POST /api/analysis/correction en lugar de solo loggear en consola.

#### Scenario: Corrección exitosa
- **WHEN** el usuario selecciona una corrección en el dropdown inline o el panel de correcciones
- **THEN** el sistema envía la corrección al endpoint POST /api/analysis/correction
- **AND** el payload incluye: rawName, insurerName, systemMapping, userCorrection, correctionType, quoteId
- **AND** opcionalmente incluye: rawTextSnippet, aiJustification, pageNumber

#### Scenario: Corrección con campos extendidos
- **WHEN** la corrección incluye evidencia de la celda (snippet, página, justificación)
- **THEN** estos campos se incluyen en el payload
- **AND** el backend los almacena en la tabla coverage_mappings

#### Scenario: Respuesta exitosa
- **WHEN** el servidor responde con HTTP 200
- **THEN** la celda se actualiza visualmente con el nuevo valor
- **AND** el indicador de discrepancia cambia a check verde
- **AND** se muestra un toast: "Corrección guardada. Motor de aprendizaje actualizado."

### Requirement: Estado optimista de corrección
El sistema SHALL actualizar la UI inmediatamente antes de recibir confirmación del servidor.

#### Scenario: Actualización optimista
- **WHEN** el usuario confirma una corrección
- **THEN** la celda cambia inmediatamente al valor corregido
- **AND** se muestra un indicador visual de "guardando" (spinner sutil)
- **AND** si el servidor confirma, el indicador desaparece

#### Scenario: Reversión en error
- **WHEN** el servidor responde con error
- **THEN** la celda revierte automáticamente al valor original
- **AND** se muestra un toast de error: "Error guardando corrección. Intente de nuevo."
- **AND** el dropdown de corrección permanece abierto para reintentar

### Requirement: Manejo de errores y retry
El sistema SHALL manejar errores de red y servidor con retry automático.

#### Scenario: Retry automático
- **WHEN** la petición falla por error de red (timeout, 5xx)
- **THEN** el sistema reintenta automáticamente hasta 3 veces
- **AND** usa backoff exponencial (1s, 2s, 4s)

#### Scenario: Error persistente
- **WHEN** la petición falla después de 3 intentos
- **THEN** la corrección se guarda en una cola local (offline queue)
- **AND** se muestra un toast: "Guardado localmente. Se sincronizará cuando haya conexión."

### Requirement: Cola offline de correcciones
El sistema SHALL almacenar correcciones pendientes localmente cuando no hay conexión.

#### Scenario: Sin conexión
- **WHEN** el usuario confirma una corrección sin conexión a internet
- **THEN** la corrección se guarda en localStorage/IndexedDB
- **AND** se marca como "pendiente de sincronización"
- **AND** la UI muestra indicador visual de "sincronización pendiente"

#### Scenario: Sincronización al recuperar conexión
- **WHEN** la conexión se restablece
- **THEN** el sistema intenta sincronizar automáticamente las correcciones pendientes
- **AND** las correcciones exitosas se eliminan de la cola local
- **AND** las fallidas se reintentan en el próximo ciclo

### Requirement: Feedback visual de estado
El sistema SHALL proporcionar feedback visual claro sobre el estado de cada corrección.

#### Scenario: Estado pending
- **WHEN** una corrección está siendo enviada
- **THEN** la celda muestra un spinner sutil o borde punteado

#### Scenario: Estado success
- **WHEN** una corrección fue guardada exitosamente
- **THEN** la celda muestra un check verde con efecto de micro-destello
- **AND** un toast confirma: "Corrección guardada. Motor de aprendizaje actualizado con peso 1.5"

#### Scenario: Estado error
- **WHEN** una corrección falló
- **THEN** la celda muestra un icono de error
- **AND** un toast muestra el error específico
- **AND** se proporciona botón "Reintentar"

## Dependencies
- Endpoint POST /api/analysis/correction (existente)
- Componentes UnifiedCoverageMatrix y CorrectionUI
- learning-engine (backend)
