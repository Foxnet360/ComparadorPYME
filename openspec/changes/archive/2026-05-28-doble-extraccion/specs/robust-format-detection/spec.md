## ADDED Requirements

### Requirement: Clasificación Inmune por Escaneo de Texto Nativo
El sistema MUST inspeccionar dinámicamente el contenido textual extraído nativamente del PDF para identificar el emisor de la cotización antes de recurrir a la heurística basada en el nombre del archivo.

#### Scenario: Clasificación Exitosa por Contenido de Texto
- **WHEN** un documento PDF es cargado con un nombre genérico (ej: `doc_123.pdf`) pero contiene la cadena "HDI Seguros" o "Chubb" en su texto nativo
- **THEN** el sistema identifica la aseguradora correspondiente y asigna la familia de formato optimizada (`TABLE-DOUBLE` o `TABLE-INTEGRATED`) de manera automática.

#### Scenario: Fallback Seguro a Nombre de Archivo
- **WHEN** el texto nativo del PDF no contiene palabras clave legibles del emisor o está en formato puramente imagen (sin texto nativo)
- **THEN** el sistema evalúa el nombre físico del archivo y, como último recurso, asume `UNKNOWN` aplicando un prompt genérico y seguro de extracción.
