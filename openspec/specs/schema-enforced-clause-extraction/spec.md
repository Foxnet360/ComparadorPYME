# Spec: Schema-Enforced Clause Extraction

## Capability
Extracción estructurada de clausulados generales y particulares utilizando schemas rígidos nativos en la API de Gemini para garantizar paridad sintáctica y tipado.

## Requirements

### Requirement: Enforzamiento Sintáctico por Schema
El sistema DEBE garantizar que la respuesta del LLM para la extracción de clausulados se ajuste estrictamente a un esquema estructurado (JSON Schema) predefinido a través de la API nativa de Gemini (`responseSchema`).

#### Scenario: Extracción de Cláusulas Exitosa
- **WHEN** el texto crudo del clausulado de seguros es enviado a `structuredClauseExtractor.ts`
- **THEN** la API de Gemini devuelve un JSON semánticamente estructurado que contiene coberturas, deducibles compuestos (con componentes y texto crudo), exclusiones generales, condiciones y definiciones, sin añadir texto introductorio o explicativo fuera del JSON.

#### Scenario: Fallback Seguro ante Error de Extracción
- **WHEN** la llamada a la API de Gemini para la extracción de clausulado devuelve un error o excede los límites
- **THEN** el sistema registra el error, realiza un degradado elegante (graceful degradation) hacia el RAG legacy y evita caídas generales del servidor HTTP.

## Dependencies
- `gemini-model-configuration` para configuración de modelos
- `clause-storage` para almacenamiento de cláusulas estructuradas
