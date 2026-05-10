## ADDED Requirements

### Requirement: Detectar aseguradora del PDF
El sistema DEBE identificar automáticamente qué aseguradora emitió una cotización basándose en el texto extraído.

#### Scenario: Detección por nombre en texto
- **WHEN** se extrae texto de un PDF de cotización
- **THEN** el sistema DEBE identificar la aseguradora (SBS, BBVA, MAPFRE, etc.)
- **AND** usar patrones regex configurados por perfil
- **AND** fallback a "UNKNOWN" si no se puede detectar

#### Scenario: Detección por metadata del PDF
- **WHEN** un PDF tiene metadata con autor o título
- **THEN** el sistema DEBE usar esa información para identificar la aseguradora
- **AND** combinar con detección por texto para mayor precisión

### Requirement: Perfiles de extracción por aseguradora
El sistema DEBE tener perfiles específicos con prompts, mapeos y validaciones para cada aseguradora soportada.

#### Scenario: Perfil de BBVA
- **WHEN** se detecta una cotización de BBVA
- **THEN** el sistema DEBE usar el perfil específico de BBVA
- **AND** incluir few-shot examples de formatos BBVA
- **AND** aplicar mapeo de coberturas propio de BBVA
- **AND** validar rangos de prima típicos de BBVA

#### Scenario: Perfil de SBS
- **WHEN** se detecta una cotización de SBS
- **THEN** el sistema DEBE usar el perfil específico de SBS
- **AND** manejar formato de tabla de coberturas de SBS
- **AND** mapear "Hurto Calificado" a "Sustracción / Hurto"
- **AND** validar estructura específica de SBS

#### Scenario: Perfil genérico como fallback
- **WHEN** se detecta una aseguradora sin perfil específico
- **THEN** el sistema DEBE usar el perfil genérico
- **AND** aplicar prompt base con instrucciones generales
- **AND** usar mapeo canónico estándar

### Requirement: Validación estricta con schema
El sistema DEBE validar el JSON extraído usando un schema estricto (Zod/Joi) antes de usar los datos.

#### Scenario: Validación exitosa
- **WHEN** Gemini retorna JSON estructurado
- **THEN** el sistema DEBE validar contra schema Zod
- **AND** verificar tipos de datos (números, strings, enums)
- **AND** validar rangos (prima > 0, coberturas presentes)
- **AND** aceptar datos si pasan validación

#### Scenario: Validación fallida con reparación
- **WHEN** el JSON no pasa validación Zod
- **THEN** el sistema DEBE intentar reparación automática
- **AND** si es irreparable, marcar como "needs_review"
- **AND** loggear errores de validación para análisis

### Requirement: Extracción con Gemini 2.5 Pro
El sistema DEBE usar `gemini-2.5-pro` para extracción estructurada de cotizaciones.

#### Scenario: Extracción de tabla compleja
- **WHEN** una cotización tiene tablas con múltiples coberturas
- **THEN** el sistema DEBE usar Gemini 2.5 Pro
- **AND** enviar el texto pre-procesado
- **AND** recibir JSON estructurado con alta precisión
- **AND** el resultado DEBE tener confianza > 85%

#### Scenario: Fallback a Flash si Pro falla
- **WHEN** Gemini 2.5 Pro retorna error (rate limit, timeout)
- **THEN** el sistema DEBE fallback a Gemini 2.5 Flash
- **AND** aplicar el mismo perfil de extracción
- **AND** marcar la extracción con menor confianza
