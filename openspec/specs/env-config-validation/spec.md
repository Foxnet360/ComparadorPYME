# Spec: Environment Configuration Validation

## Purpose
Validación centralizada de variables de entorno con mensajes de error claros y un único archivo `.env` en la raíz del proyecto.

## ADDED Requirements

### Requirement: Single source of truth for environment variables
The system SHALL use a single `.env` file located at the project root as the only source of environment configuration.

#### Scenario: Server loads configuration from root .env
- **WHEN** the Express server starts
- **THEN** it SHALL load environment variables from the `.env` file in the project root directory
- **AND** it SHALL NOT require a separate `.env` file in the `server/` directory

#### Scenario: Missing required variables prevent startup
- **WHEN** a required environment variable (GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_ANON_KEY) is not defined
- **THEN** the server SHALL log a clear error message listing all missing variables
- **AND** the server SHALL exit with process code 1

### Requirement: Environment variable validation
The system SHALL validate all environment variables at startup and provide actionable error messages.

#### Scenario: Valid environment configuration
- **WHEN** all required environment variables are present and valid
- **THEN** the server SHALL start normally
- **AND** it SHALL log a confirmation message with the loaded configuration (excluding secrets)

#### Scenario: Invalid numeric environment variable
- **WHEN** an environment variable that expects a numeric value (e.g., PORT, SMMLV_VALUE) contains non-numeric text
- **THEN** the server SHALL log a warning with the variable name and invalid value
- **AND** it SHALL use a sensible default if available

### Requirement: Environment configuration template
The system SHALL provide a `.env.example` file documenting all required and optional environment variables.

#### Scenario: Developer sets up local environment
- **WHEN** a developer clones the repository
- **THEN** they SHALL find a `.env.example` file in the project root
- **AND** the file SHALL contain all required variables with placeholder values
- **AND** the file SHALL document which variables are required vs optional

### Requirement: Dynamic CORS origins
The system SHALL read allowed CORS origins from an environment variable instead of hardcoded values.

#### Scenario: Production deployment with custom domain
- **WHEN** the `CORS_ORIGINS` environment variable is set to a JSON array of URLs
- **THEN** the Express server SHALL allow requests from those origins
- **AND** it SHALL reject requests from origins not in the list

#### Scenario: Development without CORS_ORIGINS set
- **WHEN** the `CORS_ORIGINS` environment variable is not defined
- **THEN** the server SHALL default to allowing localhost origins (`http://localhost:3000`, `http://localhost:8080`)
