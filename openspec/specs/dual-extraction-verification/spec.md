# Spec: Dual Extraction Verification

## Capability
Doble extracción independiente de coberturas críticas (Incendio y Responsabilidad Civil) con contraste automático para la detección de alucinaciones del modelo LLM.

## Requirements

### Requirement: Doble Inferencia Cruzada para Coberturas Críticas
El sistema MUST realizar una segunda llamada independiente a la API de Gemini para extraer de forma redundante las coberturas críticas (Incendio y Responsabilidad Civil) y evaluar discrepancias.

#### Scenario: Coberturas Consistentes
- **WHEN** los valores y deducibles de Incendio y RC son idénticos o tienen una discrepancia menor o igual al 20% entre la primera y segunda extracción
- **THEN** el sistema valida los valores automáticamente y no genera alertas de discrepancia.

#### Scenario: Discrepancia Detectada
- **WHEN** los valores numéricos extraídos de Incendio o RC difieren en más del 20% o las estructuras de deducibles son incompatibles
- **THEN** el sistema genera una alerta de discrepancia crítica, marca la cotización como `needsReview: true` y solicita una revisión manual del corredor en la interfaz.

## Dependencies
- `gemini-model-configuration` para configuración de API
- `quote-analysis-v2` para extracción primaria
- `normalized-deductible-ui` para visualización de alertas
