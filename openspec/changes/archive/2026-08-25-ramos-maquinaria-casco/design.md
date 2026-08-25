# Design: Incorporación de Ramos "Maquinaria y Equipo" y "Casco Embarcación"

## Domain Architecture & Regulatory Alignments

### 1. Ramo `equipo_maquinaria` ("Rotura de Maquinaria y Equipo Contratista")
- **Marco Regulatorio Colombiano:**
  - Código de Comercio — Artículos 1083 al 1112 (Seguros de Daños Patrimoniales).
  - Circular Básica Jurídica Superfinanciera (Parte II, Título IV, Cap. II).
- **Categorías Clave de Cobertura (`taxonomy.json`):**
  - `eqm_01`: Daño Físico por Causa Externa / Accidente Accidental
  - `eqm_02`: Rotura Mecánica Interna y Falla Eléctrica
  - `eqm_03`: Sustracción y Robo de Maquinaria
  - `eqm_04`: Responsabilidad Civil Extracontractual por Operación de Maquinaria
  - `eqm_05`: Gastos Extraordinarios (Fletes Aéreos, Trabajo Nocturno)
  - `eqm_06`: Pérdida de Beneficios por Paralización (Lucro Cesante)
  - `eqm_07`: Cobertura en Tránsito y Movilización Terrestre

### 2. Ramo `casco_embarcacion` ("Casco, Maquinaria Marítima y P&I")
- **Marco Regulatorio Colombiano e Internacional:**
  - Código de Comercio — Libro V (De la Navegación y Seguro Marítimo, Arts. 1703 a 1772).
  - Decreto 2324 de 1984 & Resoluciones DIMAR (Dirección General Marítima).
  - Cláusulas del Instituto de Aseguradores de Londres (Institute Time Clauses - Hulls / ITCH).
- **Categorías Clave de Cobertura (`taxonomy.json`):**
  - `cas_01`: Pérdida Total o Parcial de Casco y Maquinaria (Institute Time Clauses)
  - `cas_02`: Avería Gruesa y Gastos de Salvamento Marítimo
  - `cas_03`: Responsabilidad Civil por Abordaje (3/4th o 4/4ths Collision Liability)
  - `cas_04`: Protección e Indemnización (P&I - Pollution & Crew Liability)
  - `cas_05`: Riesgos de Guerra y Huelgas Marítimas (Institute War and Strikes Clauses)
  - `cas_06`: Remolque y Gastos de Asistencia Marítima
  - `cas_07`: Cobertura de Maquinaria Auxiliar y Motores Fuera de Borda

### 3. Integración en UI (`DomainSelector.tsx` & `ClientSelector.tsx`)
- `DomainSelector.tsx`: Se integra el grid a 10 ramos, usando íconos `Cog` (Maquinaria) y `Anchor` (Casco Embarcación).
- `ClientSelector.tsx`: Se agregan 2 secciones condicionales con los campos técnicos específicos para ambos ramos.
