# Clause Storage

Capacidad de almacenar y gestionar clausulados pre-procesados en Firestore.

## ADDED Requirements

### Requirement: Almacenamiento de clausulados

El sistema debe almacenar clausulados con metadata estructurada para búsqueda y reutilización.

#### Scenario: Crear nuevo clausulado

- **WHEN** un admin sube un PDF de clausulado con metadata (aseguradora, producto, año)
- **THEN** el sistema extrae el texto y lo almacena en Firestore
- **AND** genera un hash SHA256 para detección de cambios
- **AND** registra la fecha de creación

#### Scenario: Buscar clausulados por aseguradora

- **WHEN** se solicita lista de clausulados para una aseguradora
- **THEN** el sistema retorna todos los clausulados activos de esa aseguradora
- **AND** incluye producto, versión y fecha de actualización

#### Scenario: Detectar clausulado duplicado

- **WHEN** se sube un clausulado con el mismo hash que uno existente
- **THEN** el sistema notifica que ya existe
- **AND** ofrece opción de actualizar metadata o cancelar

### Requirement: API de consulta

#### Scenario: Obtener clausulado por ID

- **WHEN** se solicita un clausulado específico por ID
- **THEN** el sistema retorna el documento completo incluyendo texto y secciones

#### Scenario: Listar aseguradoras disponibles

- **WHEN** se solicita lista de aseguradoras
- **THEN** el sistema retorna aseguradoras únicas con conteo de clausulados
