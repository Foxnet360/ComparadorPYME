## ADDED Requirements

### Requirement: Matching multinivel de coberturas
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

### Requirement: Enriquecimiento de datos de cobertura
Cada cobertura parseada SHALL incluir metadatos de mapeo semántico además de los campos existentes.

#### Scenario: Estructura enriquecida
- **WHEN** el sistema parsea una cotización
- **THEN** cada cobertura incluye: `canonicalName`, `categoryId` (1-14 o null), `matchConfidence` (0-1), `matchMethod` (thesaurus/fuzzy/embedding/llm/null)

#### Scenario: Validación de categoryId
- **WHEN** el sistema asigna un categoryId
- **THEN** el valor MUST estar entre 1 y 14 inclusive, o ser null para no categorizadas

### Requirement: Configuración de categorías canónicas
El sistema SHALL usar exactamente 14 categorías canónicas basadas en la Plantilla PYME colombiana.

#### Scenario: Lista de categorías
- **WHEN** el sistema inicializa el matcher
- **THEN** carga las 14 categorías: Incendio (Edificio y Contenidos), Lucro Cesante, Sustracción/Hurto, Equipo Eléctrico y Electrónico, Rotura de Maquinaria, Responsabilidad Civil (RCE), Vidrios Planos, Manejo Global/Infidelidad, Transporte de Mercancías, Transporte de Valores, Asistencia PYME, Asistencia Legal, Huelga/Motín/Asonada (HMACC), Terremoto y Eventos Catastróficos

### Requirement: Performance del matching
El sistema SHALL completar el matching de todas las coberturas de una cotización en menos de 5 segundos.

#### Scenario: Cotización típica
- **WHEN** una cotización tiene 15 coberturas
- **THEN** el matching completo toma < 5 segundos, con cache de embeddings para evitar regeneración

## MODIFIED Requirements

### Requirement: Extracción de datos estructurados de cotización
El sistema SHALL extraer datos estructurados de cotizaciones de seguros y enriquecer cada cobertura con metadatos de categorización canónica.

#### Scenario: Extracción con mapeo semántico
- **WHEN** el usuario sube PDFs de cotizaciones
- **THEN** el sistema extrae coberturas y para cada una asigna: nombre original, nombre canónico, categoría (1-14), confianza del match, y método usado
