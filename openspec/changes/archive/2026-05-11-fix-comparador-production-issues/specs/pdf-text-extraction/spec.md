## ADDED Requirements

### Requirement: Prompt de extracción separa valor y deducible
El prompt enviado a Gemini DEBE instruir explícitamente al modelo para separar el monto asegurado (`value`) del deducible (`deductible`) en cada cobertura.

#### Scenario: Extracción separada de campos
- **WHEN** el sistema envía el prompt a Gemini
- **THEN** el prompt incluye instrucciones claras: "El campo 'value' es SOLO el monto asegurado. El campo 'deductible' es SOLO la cuota de participación"
- **AND** incluye ejemplos de ambos campos separados

#### Scenario: Validación post-extracción
- **WHEN** Gemini retorna el JSON con las coberturas
- **THEN** el sistema valida que `value` no contenga texto de deducible
- **AND** valida que `deductible` no contenga montos asegurados
- **AND** si detecta mezcla, reintenta la extracción con instrucciones más específicas

## MODIFIED Requirements

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
