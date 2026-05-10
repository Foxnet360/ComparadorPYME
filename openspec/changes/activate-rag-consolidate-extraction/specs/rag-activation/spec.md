## ADDED Requirements

### Requirement: Reindexar clausulados existentes
El sistema DEBE ejecutar el script de reindexación para poblar la tabla de chunks con clausulados ya subidos.

#### Scenario: Reindexación de SBS y HDI
- **WHEN** se ejecuta `scripts/reindex-clauses.ts`
- **THEN** el sistema DEBE descargar los PDFs de Supabase Storage
- **AND** extraer texto y crear chunks
- **AND** generar embeddings
- **AND** almacenar en la tabla de chunks
- **AND** reportar éxito o fallo por documento

#### Scenario: Subida de clausulados de ejemplo
- **WHEN** se suben clausulados de MAPFRE, BBVA, AXA, CHUBB, Bolívar
- **THEN** el sistema DEBE indexarlos automáticamente
- **AND** verificar que tienen chunks generados
- **AND** confirmar que el RAG puede encontrarlos

### Requirement: Verificar funcionamiento del RAG
El sistema DEBE validar que la búsqueda RAG retorna resultados reales después de la indexación.

#### Scenario: Query de prueba post-indexación
- **WHEN** se realiza una búsqueda por "Responsabilidad Civil deducible"
- **THEN** el sistema DEBE retornar chunks relevantes
- **AND** los chunks DEBEN pertenecer a clausulados indexados
- **AND** la similitud DEBE ser mayor a 0.7

#### Scenario: Chat con contexto de clausulados
- **WHEN** el usuario pregunta "¿Qué dice el clausulado de SBS sobre terremoto?"
- **THEN** el sistema DEBE encontrar chunks del clausulado SBS
- **AND** generar una respuesta basada en el contenido real
- **AND** NO DEBE responder "no tengo información"
