# Spec: RAG Audit Enrichment (Delta)

## MODIFIED Requirements

### Requirement: Enriquecimiento RAG de alertas
**Reason**: The clause availability check queries the wrong table (clause_chunks which is empty) instead of chunks which contains actual indexed data.

El sistema DEBE buscar automáticamente en clausulados indexados para fundamentar cada alerta generada durante el análisis, consultando la tabla correcta de chunks.

#### Scenario: Alerta con clausulado disponible
- **WHEN** una alerta CRITICAL indica "Deducible Terremoto sobre Valor Asegurado 15%"
- **THEN** el sistema busca en Supabase tabla `chunks` relacionados a "deducible terremoto"
- **AND** encuentra el chunk: "Art. 5.2: El deducible será del 15% sobre el valor total asegurado"
- **AND** agrega la cita como evidence con similitud score

#### Scenario: Alerta sin clausulado disponible
- **WHEN** una alerta no tiene clausulado indexado para esa aseguradora
- **THEN** el sistema marca la alerta como "Análisis inferido de cotización"
- **AND** proporciona contexto técnico basado en datos extraídos

### Requirement: Botón condicional
**Reason**: checkClausesAvailability always returns false because it queries clause_chunks instead of chunks.

El botón "Enriquecer" solo debe estar disponible cuando hay clausulados.

#### Scenario: Clausulados disponibles
- **WHEN** existe al menos un chunk en la tabla `chunks` para documentos de tipo CLAUSULADO_GENERAL o CLAUSULADO_PARTICULAR
- **THEN** el botón "Enriquecer con Clausulados" está activo

#### Scenario: Sin clausulados
- **WHEN** no hay chunks para documentos de tipo clausulado
- **THEN** se muestra mensaje: "No hay clausulados indexados disponibles. Suba clausulados para enriquecer el análisis con referencias normativas."

## ADDED Requirements

### Requirement: Check clause availability from correct table
The system SHALL check for clause document chunks in the `chunks` table, which is the actual table populated by the document indexing service.

#### Scenario: Chunks table has clause data
- **WHEN** `checkClausesAvailability` is called with insurer names
- **THEN** it SHALL first query the `chunks` table joined with `documents`
- **AND** filter by document_type in ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR']
- **AND** return true if any chunks exist

#### Scenario: Fallback to clause_chunks
- **WHEN** the `chunks` table has no matching records
- **THEN** the system MAY query `clause_chunks` as fallback
- **AND** if neither table has data, return false

### Requirement: Apply migration 013 structured clauses
The system SHALL ensure the `search_structured_clauses` PostgreSQL function exists in the database.

#### Scenario: Function exists
- **WHEN** the application starts or performs structured clause search
- **THEN** it SHALL verify `search_structured_clauses` function exists
- **AND** if not, log a warning suggesting migration 013 needs to be applied

#### Scenario: Graceful degradation
- **WHEN** `search_structured_clauses` is called but the function does not exist
- **THEN** the system SHALL catch the error gracefully
- **AND** fallback to legacy RAG retrieval
- **AND** log an info-level message (not error) about the fallback
