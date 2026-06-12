# Spec: Semantic Coverage Matching

## Capability
Sistema de matching multinivel (4 capas) que mapea nombres de cobertura extraídos de cotizaciones a 14 categorías canónicas de la Plantilla PYME.

## User Story
**Como** usuario del comparador
**Quiero** ver coberturas equivalentes agrupadas bajo categorías estándar
**Para** comparar cotizaciones de diferentes aseguradoras fácilmente

## Functional Requirements

### FR-1: Matching multinivel de coberturas
El sistema SHALL mapear cada cobertura extraída de una cotización a una de 14 categorías canónicas usando un sistema de 4 capas en cascada.

#### Scenario: Match exacto por thesaurus
- **WHEN** una cobertura extraída coincide exactamente con un sinónimo en el thesaurus
- **THEN** el sistema asigna la categoría canónica con confianza 1.0 y método "thesaurus"

#### Scenario: Match por fuzzy similarity
- **WHEN** una cobertura no coincide exactamente pero tiene distancia Levenshtein < 3 con un sinónimo
- **THEN** el sistema asigna la categoría canónica con confianza calculada como 1 - (distancia/longitud) y método "fuzzy"

#### Scenario: Match por embedding similarity
- **WHEN** una cobertura no coincide por thesaurus ni fuzzy
- **THEN** el sistema genera embedding del nombre de cobertura, compara con embeddings de las 14 categorías, y asigna la más similar si cosine similarity > 0.7 con método "embedding"

#### Scenario: Match por LLM fallback
- **WHEN** una cobertura tiene confianza < 0.6 en las capas 1-3
- **THEN** el sistema consulta Gemini con un prompt específico de clasificación y asigna categoría con confianza basada en la respuesta y método "llm"

#### Scenario: Cobertura no categorizable
- **WHEN** una cobertura tiene confianza < 0.6 en todas las capas
- **THEN** el sistema marca la cobertura como "no categorizada" con categoryId null y confianza 0

### FR-2: Enriquecimiento de datos de cobertura
Cada cobertura parseada SHALL incluir metadatos de mapeo semántico además de los campos existentes.

#### Scenario: Estructura enriquecida
- **WHEN** el sistema parsea una cotización
- **THEN** cada cobertura incluye: `canonicalName`, `categoryId` (1-14 o null), `matchConfidence` (0-1), `matchMethod` (thesaurus/fuzzy/embedding/llm/null)

#### Scenario: Validación de categoryId
- **WHEN** el sistema asigna un categoryId
- **THEN** el valor MUST estar entre 1 y 14 inclusive, o ser null para no categorizadas

### FR-3: Configuración de categorías canónicas
El sistema SHALL usar exactamente 14 categorías canónicas basadas en la Plantilla PYME colombiana.

#### Scenario: Lista de categorías
- **WHEN** el sistema inicializa el matcher
- **THEN** carga las 14 categorías: Incendio (Edificio y Contenidos), Lucro Cesante, Sustracción/Hurto, Equipo Eléctrico y Electrónico, Rotura de Maquinaria, Responsabilidad Civil (RCE), Vidrios Planos, Manejo Global/Infidelidad, Transporte de Mercancías, Transporte de Valores, Asistencia PYME, Asistencia Legal, Huelga/Motín/Asonada (HMACC), Terremoto y Eventos Catastróficos

### FR-4: Performance del matching
El sistema SHALL completar el matching de todas las coberturas de una cotización en menos de 5 segundos.

#### Scenario: Cotización típica
- **WHEN** una cotización tiene 15 coberturas
- **THEN** el matching completo toma < 5 segundos, con cache de embeddings para evitar regeneración

## Categorías Canónicas
| ID | Nombre | Sinónimos Comunes |
|----|--------|-------------------|
| 1 | Incendio (Edificio y Contenidos) | Inmuebles, Daño Material, Edificio |
| 2 | Lucro Cesante | Pérdida de Utilidades, Interrupción |
| 3 | Sustracción/Hurto | Robo, Mercancías, Contenido |
| 4 | Equipo Eléctrico y Electrónico | Equipo Electrónico, Maquinaria |
| 5 | Rotura de Maquinaria | Maquinaria, Equipo |
| 6 | Responsabilidad Civil (RCE) | RC, Daños a Terceros, Extranjera |
| 7 | Vidrios Planos | Cristales, Vidrios, Rotura |
| 8 | Manejo Global/Infidelidad | Infidelidad, Manejo, Empleados |
| 9 | Transporte de Mercancías | Mercancías, Tránsito |
| 10 | Transporte de Valores | Valores, Efectivo |
| 11 | Asistencia PYME | Asistencia, Apoyo |
| 12 | Asistencia Legal | Legal, Jurídico |
| 13 | Huelga/Motín/Asonada (HMACC) | Huelga, Motín, Asonada |
| 14 | Terremoto y Eventos Catastróficos | Terremoto, Catastrófico, Sismo |

## Dependencies
- Servicio de embeddings
- Thesaurus de coberturas
- Gemini API (para fallback LLM)

---

## ADDED Requirements (from change: arquitectura-fluida-comparador-seguros)

### Requirement: Support probabilistic coverage mapping
The system SHALL map coverage names to semantic groups with probability scores rather than single mappings.

#### Scenario: Probabilistic mapping
- **WHEN** "AMPARO BASICO - TODO RIESGO DANO MATERIAL" is processed
- **THEN** the system returns:
  - Group: "Patrimoniales > Edificios", Confidence: 85%
  - Group: "Patrimoniales > Equipos", Confidence: 60%
  - Group: "Riesgos Especiales > Terremoto", Confidence: 45%

### Requirement: Detect composite coverages
The system SHALL identify when a coverage represents multiple underlying coverages.

#### Scenario: Composite detection
- **WHEN** a "TODO RIESGO" or "AMPARO BASICO" coverage is found
- **THEN** the system flags it as composite
- **AND** lists likely component coverages

## MODIFIED Requirements (from change: arquitectura-fluida-comparador-seguros)

### Requirement: Map raw coverage names to canonical categories
The system SHALL map extracted coverage names to canonical categories using the thesaurus.

#### Scenario: Thesaurus-based mapping
- **WHEN** a coverage name is extracted from a quote
- **THEN** the system checks the thesaurus for exact matches
- **AND** if found, maps to the canonical category
- **AND** records the match method (exact, synonym, or fuzzy)

### Requirement: Use semantic similarity for coverage matching
The system SHALL use vector embeddings to find semantically similar coverages when thesaurus matching fails.

#### Scenario: Embedding-based matching
- **WHEN** a coverage name has no thesaurus match
- **THEN** the system generates an embedding for the coverage name
- **AND** compares it to embeddings of canonical categories
- **AND** returns the most similar category if above threshold

## REMOVED Requirements (from change: arquitectura-fluida-comparador-seguros)

### Requirement: Force single canonical category mapping
**Reason**: Replaced by probabilistic mapping to semantic groups
**Migration**: Use semantic group probabilities instead of single canonical names

---

## MODIFIED Requirements (from change: correccion-cotizacion-allianz)

### Requirement: FR-1 updated - Batch embedding processing
The embedding layer (capa 3) SHALL use batch processing.

#### Scenario: Batch embedding match
- **WHEN** multiple coverages fail thesaurus and fuzzy matching
- **THEN** the system SHALL collect them into a batch
- **AND** send ONE API call for all coverages in the batch
- **AND** receive embeddings for all coverages in the response
- **AND** compare each with category embeddings
- **AND** assign matches with cosine similarity > 0.7

#### Scenario: Hybrid matching order
- **WHEN** normalizing coverages
- **THEN** the system SHALL:
  1. Check thesaurus exact match (instant)
  2. Check fuzzy match with Levenshtein < 3 (instant)
  3. Check persistent cache for embedding (fast, <50ms)
  4. Generate batch embedding for remaining coverages (~7s per batch)
  5. Compare with category embeddings
  6. For confidence < 0.6, use LLM fallback

#### Requirement: FR-4 updated - Performance target
The performance target SHALL be updated to account for batch processing.

##### Scenario: 15 coverage quote
- **WHEN** a quote has 15 coverages
- **THEN** total matching time SHALL be < 30 seconds
- **AND** thesaurus/fuzzy matches SHALL be instant
- **AND** cache hits SHALL be < 50ms each
- **AND** batch embedding SHALL take < 10 seconds for all unmatched coverages

##### Scenario: 22 coverage quote
- **WHEN** a quote has 22 coverages
- **THEN** total matching time SHALL be < 45 seconds
- **AND** batches SHALL be split into groups of 10

## ADDED Requirements (from change: correccion-cotizacion-allianz)

### Requirement: Persistent cache integration
The matching system SHALL use persistent embedding cache.

#### Scenario: Cache lookup in matching pipeline
- **BEFORE** generating embeddings
- **WHEN** a coverage needs embedding
- **THEN** the system SHALL check persistent cache (Supabase) first
- **AND** only generate embeddings for cache misses

### Requirement: Batch similarity computation
The system SHALL compute similarities efficiently for batches.

#### Scenario: Matrix similarity computation
- **WHEN** 10 coverage embeddings are ready
- **THEN** compute cosine similarity against 14 category embeddings using matrix operations
- **AND** return best match for each coverage

---

## Delta from change: mejora-extraccion-coberturas

## MODIFIED Requirements

### Requirement: Support probabilistic coverage mapping

The system SHALL map coverage names to canonical categories using graph probabilities and composite decomposition rules, in addition to the existing thesaurus/fuzzy/embedding/LLM layers.

(Previously: mapping returned a flat list of semantic groups without insurer-aware graph probabilities or composite decomposition.)

#### Scenario: Probabilistic mapping with graph

- **WHEN** "AMPARO BASICO - TODO RIESGO DANO MATERIAL" is processed
- **THEN** the system returns graph-ranked mappings:
  - `incendio-edificio-contenidos`: 0.85
  - `equipo-electronico`: 0.60
  - `terremoto-catastrofico`: 0.45
- **AND** flags the coverage as composite when a decomposition rule matches

#### Scenario: Composite detection uses graph rules

- **WHEN** a coverage matches a graph decomposition rule
- **THEN** the system flags it as composite
- **AND** lists component coverages derived from the rule
