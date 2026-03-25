# PDF Text Extraction

Capacidad de extraer texto plano de PDFs de cotizaciones y clausulados para reducir consumo de tokens.

## ADDED Requirements

### Requirement: Extracción de texto de PDFs nativos

El sistema debe extraer el contenido textual de archivos PDF que contienen texto nativo (no escaneado) antes de enviarlo al modelo de IA.

#### Scenario: PDF de cotización válido

- **WHEN** se recibe un archivo PDF de cotización con texto nativo
- **THEN** el sistema extrae el texto completo preservando saltos de línea
- **AND** el texto se envía al modelo como string, no como archivo binario

#### Scenario: PDF protegido con contraseña

- **WHEN** se recibe un PDF protegido con contraseña
- **THEN** el sistema registra un error descriptivo
- **AND** continúa procesando los demás archivos

#### Scenario: Múltiples PDFs en una solicitud

- **WHEN** se reciben N cotizaciones + M clausulados
- **THEN** cada PDF se extrae y etiqueta con su nombre de archivo
- **AND** el texto combinado se envía en una sola llamada al modelo

### Requirement: Formato estructurado del texto extraído

El texto extraído debe incluir marcadores claros para que el modelo identifique cada documento.

#### Scenario: Estructura del texto enviado

- **WHEN** se construye el prompt para el modelo
- **THEN** cada documento se envuelve con marcadores:
  ```
  === INICIO [TIPO]: [nombre_archivo] ===
  [texto]
  === FIN [TIPO] ===
  ```
- **AND** TIPO es "COTIZACIÓN" o "CLAUSULADO"
