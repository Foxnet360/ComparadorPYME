# Spec: Robust Format Detection

## Capability
Identificación inmune al renombrado de archivos físicos para inferir la aseguradora y familia de formato mediante escaneo de texto nativo preliminar del PDF.

## Requirements

### Requirement: Clasificación Inmune por Escaneo de Texto Nativo
El sistema MUST inspeccionar dinámicamente el contenido textual extraído nativamente del PDF para identificar el emisor de la cotización antes de recurrir a la heurística basada en el nombre del archivo.

#### Scenario: Clasificación Exitosa por Contenido de Texto
- **WHEN** un documento PDF es cargado con un nombre genérico (ej: `doc_123.pdf`) pero contiene la cadena "HDI Seguros" o "Chubb" en su texto nativo
- **THEN** el sistema identifica la aseguradora correspondiente y asigna la familia de formato optimizada (`TABLE-DOUBLE` o `TABLE-INTEGRATED`) de manera automática.

#### Scenario: Fallback Seguro a Nombre de Archivo
- **WHEN** el texto nativo del PDF no contiene palabras clave legibles del emisor o está en formato puramente imagen (sin texto nativo)
- **THEN** el sistema evalúa el nombre físico del archivo y, como último recurso, asume `UNKNOWN` aplicando un prompt genérico y seguro de extracción.

## Dependencies
- `multimodal-pdf-extraction` para extracción de texto nativo
- `format-family-detection` para asignación de familias de formato

---

## Delta from change: robustez-extraccion-cotizaciones-clausulados

## MODIFIED Requirements

### Requirement: Detección Basada Exclusivamente en Layout
El sistema MUST detectar familias de formato únicamente mediante patrones de estructura y layout, sin utilizar coincidencia de nombres de aseguradoras.

#### Scenario: Detección por Patrón de Layout
- **WHEN** un documento contiene encabezados "Suma Asegurada" y "Deducible" en disposición tabular
- **THEN** el sistema asigna la familia `TABLE-INTEGRATED` basándose únicamente en la estructura, sin verificar el nombre del emisor.

#### Scenario: Aseguradora Desconocida con Layout Reconocido
- **WHEN** un documento proviene de una aseguradora no catalogada pero presenta un layout `TABLE-DOUBLE` conocido
- **THEN** el sistema detecta correctamente la familia de formato sin requerir mapeo por nombre.

## REMOVED Requirements

### Requirement: Mapeo por Nombre de Aseguradora
- **Reason**: El mapeo hardcoded de etiquetas por nombre de aseguradora (ej: "HDI style") fue eliminado para hacer la detección inmune al renombrado.
- **Migration**: Toda la detección pasa a `detectFormatFamily()` basado en patrones de layout.
