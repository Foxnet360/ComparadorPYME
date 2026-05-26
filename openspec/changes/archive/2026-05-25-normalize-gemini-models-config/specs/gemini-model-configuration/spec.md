# Spec: Gemini Model Configuration

## Capability
Centralized configuration and management of all Google Gemini AI models used across the application, ensuring consistency, flexibility, and clear documentation of model assignments.

## User Story
**Como** administrador del sistema
**Quiero** configurar qué modelos de Gemini usar para cada función
**Para** optimizar costos, precisión y rendimiento sin modificar código

## ADDED Requirements

### Requirement: All Gemini models are configurable via environment variables
The system SHALL read all Gemini model selections from environment variables with sensible defaults.

#### Scenario: PDF extraction uses configured model
- **WHEN** the system extracts data from a PDF quote
- **THEN** it SHALL use the model specified in `GEMINI_MODEL` environment variable
- **AND** if `GEMINI_MODEL` is not set, it SHALL default to `gemini-3.5-flash`

#### Scenario: Chat uses configured model
- **WHEN** the system processes a chat message
- **THEN** it SHALL use the model specified in `GEMINI_CHAT_MODEL` environment variable
- **AND** if `GEMINI_CHAT_MODEL` is not set, it SHALL default to `gemini-2.5-flash-lite`

#### Scenario: Embeddings use configured model
- **WHEN** the system generates embeddings for text
- **THEN** it SHALL use the model specified in `GEMINI_EMBEDDING_MODEL` environment variable
- **AND** if `GEMINI_EMBEDDING_MODEL` is not set, it SHALL default to `gemini-embedding-2`

#### Scenario: Clause extraction uses configured model
- **WHEN** the system extracts structured clauses from documents
- **THEN** it SHALL use the model specified in `GEMINI_CLAUSE_MODEL` environment variable
- **AND** if `GEMINI_CLAUSE_MODEL` is not set, it SHALL default to `gemini-2.5-flash`

### Requirement: No hardcoded model names in production code
The system SHALL NOT contain hardcoded Gemini model names except in configuration defaults.

#### Scenario: Structured clause extractor uses env var
- **WHEN** reviewing the structured clause extraction service
- **THEN** it SHALL read the model from `GEMINI_CLAUSE_MODEL` environment variable
- **AND** it SHALL NOT contain hardcoded references to specific model versions

### Requirement: Documentation reflects actual model configuration
All deployment and configuration documentation SHALL match the actual code defaults and environment variables.

#### Scenario: README documents all model env vars
- **WHEN** a developer reads the README
- **THEN** they SHALL find documentation for all four model environment variables
- **AND** the documented defaults SHALL match the code defaults

#### Scenario: Deployment guides use correct model names
- **WHEN** a developer follows the Railway deployment guide
- **THEN** the model names in the guide SHALL match the current recommended models
- **AND** the guide SHALL mention all required environment variables
