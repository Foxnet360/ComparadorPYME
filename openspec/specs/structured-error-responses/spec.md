# Spec: Structured Error Responses

## Purpose
Respuestas de error estandarizadas con códigos, mensajes accionables y request IDs para facilitar debugging y soporte.

## ADDED Requirements

### Requirement: Categorized Gemini errors
The system SHALL categorize Gemini API errors into specific types with corresponding HTTP status codes and user-facing messages.

#### Scenario: Rate limit exceeded
- **WHEN** Gemini returns a 429 status code
- **THEN** the system SHALL respond with HTTP 429
- **AND** the error message SHALL be: "Límite de requests excedido. Espera 1 minuto y reintenta."
- **AND** the error code SHALL be `GEMINI_RATE_LIMIT`

#### Scenario: Gemini service unavailable
- **WHEN** Gemini returns a 503 status code or "Service Unavailable" message
- **THEN** the system SHALL respond with HTTP 503
- **AND** the error message SHALL be: "Gemini temporalmente no disponible. Reintenta en unos momentos."
- **AND** the error code SHALL be `GEMINI_SERVICE_UNAVAILABLE`

#### Scenario: Gemini timeout
- **WHEN** a Gemini request exceeds the timeout threshold (5 minutes)
- **THEN** the system SHALL respond with HTTP 504
- **AND** the error message SHALL be: "La extracción tomó demasiado tiempo. Intenta con un PDF más pequeño."
- **AND** the error code SHALL be `GEMINI_TIMEOUT`

#### Scenario: Invalid response from Gemini
- **WHEN** Gemini returns an unexpected or malformed response
- **THEN** the system SHALL respond with HTTP 502
- **AND** the error message SHALL be: "Respuesta inesperada de Gemini. Contacta soporte si persiste."
- **AND** the error code SHALL be `GEMINI_INVALID_RESPONSE`

#### Scenario: Unknown Gemini error
- **WHEN** Gemini returns an error that doesn't match known categories
- **THEN** the system SHALL respond with HTTP 500
- **AND** the error message SHALL be: "Error interno del servicio de IA. Contacta soporte."
- **AND** the error code SHALL be `GEMINI_UNKNOWN_ERROR`

### Requirement: Standardized error response format
The system SHALL return all errors in a consistent JSON structure.

#### Scenario: Any API error occurs
- **WHEN** any endpoint returns an error
- **THEN** the response body SHALL follow this structure:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "uuid-v4",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Requirement: Request ID tracking
The system SHALL generate and propagate a unique request ID for each incoming request.

#### Scenario: Error response includes request ID
- **WHEN** an error occurs during request processing
- **THEN** the error response SHALL include a `requestId` field
- **AND** the same request ID SHALL appear in all log entries for that request
- **AND** the request ID SHALL be returned in the response headers as `X-Request-ID`

#### Scenario: Frontend displays request ID on errors
- **WHEN** the frontend receives an error response
- **THEN** it SHALL display the request ID to the user
- **AND** it SHALL suggest including the request ID when contacting support
