# Semantic Chunking

## ADDED Requirements

### Requirement: Parse hierarchical document structure
The system SHALL detect and parse hierarchical structure in legal documents using regex patterns to identify chapters, sections, and numered clauses.

#### Scenario: Detect chapter headings
- **WHEN** text contains "CAPÍTULO" followed by roman numerals
- **THEN** the chunker SHALL mark it as a chapter boundary

#### Scenario: Detect section headings
- **WHEN** text contains "SECCIÓN" followed by roman numerals
- **THEN** the chunker SHALL mark it as a section boundary

#### Scenario: Detect numbered clauses
- **WHEN** text contains patterns like "1.1.", "1.2.", "2.1."
- **THEN** the chunker SHALL treat each numbered clause as an atomic chunk

### Requirement: Create semantic chunks from parsed structure
The system SHALL create semantic chunks that group content under their corresponding structural headings.

#### Scenario: Chunk with full context
- **WHEN** content follows a numbered clause heading
- **THEN** the chunk SHALL include the heading title plus all content until the next heading

#### Scenario: Include section reference in chunk metadata
- **WHEN** a chunk is created from a numbered clause
- **THEN** the chunk metadata SHALL include the parent chapter and section titles

### Requirement: Fallback to LLM-based chunking for unstructured documents
The system SHALL use Groq LLM to identify sections in documents that lack clear regex-detectable structure.

#### Scenario: Detect structure using LLM
- **WHEN** regex patterns fail to find any chapter/section headings in the first 5000 characters
- **THEN** the system SHALL call Groq to identify up to 10 logical sections in the document

#### Scenario: Limit LLM fallback usage
- **WHEN** LLM fallback is triggered for a document
- **THEN** the system SHALL limit to identifying maximum 10 sections to control costs

### Requirement: Preserve page references for citations
The system SHALL track page numbers for each chunk to enable accurate citations in analysis results.

#### Scenario: Track page location
- **WHEN** text is extracted page by page
- **THEN** each chunk SHALL include start and end page numbers in its metadata

### Requirement: Handle documents with article-based structure
The system SHALL handle alternative document structures that use "ARTÍCULO" instead of numeric numbering.

#### Scenario: Detect article headings
- **WHEN** text contains "ARTÍCULO" followed by a number
- **THEN** the chunker SHALL treat it as a clause boundary similar to numbered clauses
