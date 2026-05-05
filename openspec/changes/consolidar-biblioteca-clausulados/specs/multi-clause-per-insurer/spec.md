## ADDED Requirements

### Requirement: Support multiple active clause documents per insurer
The system SHALL allow multiple clause documents to be active simultaneously for the same insurer, provided they have different document types or product names.

#### Scenario: General and particular clauses for same insurer
- **WHEN** insurer "AXA" has both:
  - "CLAUSULADO_GENERAL" active (version 2024.1)
  - "CLAUSULADO_PARTICULAR" active (version 2024.1)
- **THEN** both documents SHALL remain active simultaneously
- **AND** searches for AXA clauses SHALL return both documents

#### Scenario: Multiple products for same insurer
- **WHEN** insurer "AXA" has:
  - "Póliza PYME" (CLAUSULADO_GENERAL, version 2024.1)
  - "Seguro Empresarial" (CLAUSULADO_GENERAL, version 2024.1)
- **THEN** both documents SHALL remain active simultaneously
- **AND** they SHALL be distinguishable by product name

### Requirement: Group clauses by product
The system SHALL support grouping multiple clause documents (General, Particular, Anexos) under a single product name.

#### Scenario: Product with multiple clause types
- **WHEN** creating a clause document
- **AND** specifying product_name = "Póliza PYME"
- **THEN** the system SHALL associate the document with that product
- **AND** allow other documents to share the same product_name with different document_type

#### Scenario: Search by product
- **WHEN** searching for clauses of product "Póliza PYME"
- **THEN** the system SHALL return all clause documents with that product_name
- **AND** group them by insurer

### Requirement: Validate uniqueness constraints
The system SHALL enforce uniqueness constraints to prevent duplicate active documents.

#### Scenario: Reject duplicate active document
- **WHEN** attempting to activate a document that would create duplicate:
  - same insurer + same product_name + same document_type + both active
- **THEN** the system SHALL reject the operation
- **AND** return error "Duplicate active document for this product and type"

### Requirement: Support annexes and riders
The system SHALL support clause annexes and riders as separate document types.

#### Scenario: Add rider to existing product
- **WHEN** uploading an annex for "AXA Póliza PYME"
- **AND** specifying document_type = "ANEXO"
- **THEN** the system SHALL store it as a separate document
- **AND** link it to the parent product
- **AND** include it in product searches
