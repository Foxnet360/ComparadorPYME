## MODIFIED Requirements

### Requirement: FR-2: Almacenamiento de chunks
La tabla `chunks` SHALL:
- Guardar contenido y contenido normalizado
- Guardar embedding vector(3072)
- Guardar coverage_tags (array)
- Guardar section_type
- Relacionar con document_id

#### Scenario: Vector dimensionality update
- **WHEN** storing chunks
- **THEN** the system SHALL store embeddings of dimension 3072
- **AND** utilize the gemini-embedding-2 model
