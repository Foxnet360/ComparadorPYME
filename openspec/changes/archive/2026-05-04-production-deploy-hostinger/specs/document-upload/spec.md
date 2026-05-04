# Spec: Document Upload API

## Capability
Endpoint REST para subir documentos PDF. En producción, los PDFs de cotizaciones se almacenan temporalmente en /tmp para procesamiento inmediato sin persistencia, mientras que los clausulados se almacenan en Supabase Storage para consulta RAG.

## ADDED Requirements

### Requirement: Almacenamiento temporal de cotizaciones
Los PDFs de cotizaciones DEBEN almacenarse temporalmente en /tmp durante el procesamiento y eliminarse automáticamente después.

#### Scenario: Subida de cotización
- **WHEN** un usuario sube un PDF de cotización via POST /api/analyze
- **THEN** el sistema almacena el archivo en /tmp/uploads/
- **AND** procesa el PDF inmediatamente (extracción, análisis, comparación)
- **AND** elimina el archivo de /tmp al completar el análisis
- **AND** no persiste el PDF en disco ni en base de datos

#### Scenario: Múltiples cotizaciones simultáneas
- **WHEN** un usuario sube hasta 10 PDFs de cotizaciones en una sola solicitud
- **THEN** el sistema almacena cada uno en /tmp/uploads/ con nombre único
- **AND** procesa todos secuencialmente
- **AND** elimina todos los archivos al finalizar

### Requirement: Limpieza automática de archivos temporales
El sistema DEBE garantizar que los archivos temporales se eliminen incluso si ocurre un error.

#### Scenario: Error durante procesamiento
- **WHEN** ocurre un error durante el análisis de una cotización
- **THEN** el sistema captura el error
- **AND** elimina el archivo temporal de /tmp
- **AND** retorna error al cliente sin dejar archivos huérfanos

## MODIFIED Requirements

### Requirement: Aceptar archivos PDF
El sistema DEBE aceptar multipart/form-data para subida de PDFs.

#### Scenario: Validación de archivo de cotización
- **WHEN** un usuario sube un PDF de cotización
- **THEN** el sistema valida que sea un PDF real (header %PDF-)
- **AND** verifica que el tamaño sea entre 1KB y 50MB
- **AND** sanitiza el nombre de archivo

#### Scenario: Validación de archivo de clausulado
- **WHEN** un usuario sube un PDF de clausulado
- **THEN** el sistema valida que sea un PDF real
- **AND** verifica el tamaño (hasta 100MB para clausulados extensos)
- **AND** almacena en Supabase Storage para persistencia

## REMOVED Requirements

### Requirement: Almacenamiento persistente local de PDFs
**Reason**: En producción con Hostinger, el almacenamiento local es efímero y no escalable. Los PDFs de cotizaciones no necesitan persistir después del análisis.
**Migration**: Los PDFs de cotizaciones se procesan inmediatamente y se eliminan. Los clausulados se migran a Supabase Storage.

### Requirement: Directorio uploads/ persistente
**Reason**: Los contenedores de Hostinger reinician y pierden archivos locales.
**Migration**: Usar /tmp para archivos temporales de cotizaciones y Supabase Storage para clausulados.
