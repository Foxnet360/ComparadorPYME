# Blueprint de Arquitectura: Comparador Multiramo & Multi-Aseguradora (`multiramo.md`)

## 1. Visión General y Objetivos Arquitectónicos

El objetivo de esta iniciativa es evolucionar el **Comparador de Seguros (PYME)** hacia una plataforma **Multiramo y Multi-Aseguradora** de escala empresarial. 

Actualmente, el sistema cuenta con un motor unificado V2 robusto (`UnifiedComparisonEngine`, `coverageGraphService`, `matrixTransformer`), pero la noción del ramo comercial **PYME** se encuentra acoplada implícitamente en los esquemas, prompts, parsers y visualizaciones de frontend.

### Principios Clave de la Nueva Arquitectura
1. **Multitenancy por Ramo de Negocio (`InsuranceDomain`)**: Aislamiento estricto de taxonomías, reglas de negocio, tesauros y grafos semánticos entre ramos (ej. `pyme`, `autos`, `copropiedades`, `vida_grupo`, `salud`).
2. **Soporte Multi-Aseguradora Dinámico (`InsurerRegistry`)**: Capacidad de procesar y comparar cotizaciones de cualquier aseguradora (ej. Suramericana, SBS, AXA Colpatria, Mapfre, Bolívar, Estado, Chubb) con plantillas y *hints* específicos.
3. **Patrón Strategy en Pipeline de IA**: Inyección dinámica de plantillas de prompts, esquemas de extracción Zod y scoring según el ramo y las aseguradoras seleccionadas.
4. **Desacoplamiento Frontend-Backend mediante Registros de Taxonomía**: El frontend renderizará componentes adaptativos (matrices, tablas de deducibles y badges) según la taxonomía provista por el backend para el ramo activo.

---

## 2. Modelo de Dominio y Abstracciones Centrales

### 2.1 Definición de Ramos (`InsuranceDomain`)
```typescript
export type InsuranceDomain = 
  | 'pyme' 
  | 'autos' 
  | 'copropiedades' 
  | 'vida_grupo' 
  | 'salud' 
  | 'cumplimiento' 
  | 'transporte';
```

### 2.2 Registro de Taxonomía por Ramo (`DomainTaxonomyRegistry`)
Cada ramo define sus categorías canónicas, amparos obligatorios y variables de comparación:

```typescript
export interface CoverageCategory {
  id: string;                  // ej. 'rce_autos', 'incendio_pyme', 'amparo_basico_vida'
  name: string;                // Nombre legible ej. 'Responsabilidad Civil Extracontractual'
  section: string;             // Sección en la matriz (ej. 'Coberturas Principales')
  isRequired: boolean;         // Cobertura obligatoria por norma/ley
  synonyms: string[];          // Sinónimos globales iniciales
}

export interface DomainTaxonomy {
  domain: InsuranceDomain;
  displayName: string;
  categories: CoverageCategory[];
  deductibleFormats: string[]; // Formatos comunes ej. ['% pérdida', 'SMMLV', 'Días', 'Sin Deducible']
  scoringRules: ScoringRuleConfig[];
}
```

---

## 3. Cambios en el Backend (Server Architecture)

### 3.1 Base de Datos y Persistencia (Supabase Migrations)

#### A. Tesauro por Ramo (`coverage_thesaurus`)
Se añade soporte multi-ramo y multi-aseguradora explícito:
```sql
CREATE TABLE coverage_thesaurus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(50) NOT NULL,          -- 'pyme', 'autos', 'copropiedades'
  insurer_name VARCHAR(100),            -- 'SURAMERICANA', 'SBS', NULL (global)
  raw_synonym TEXT NOT NULL,            -- "Daños a Bienes de Terceros"
  canonical_id VARCHAR(100) NOT NULL,   -- 'rce_vehicular'
  confidence FLOAT DEFAULT 1.0,
  user_corrected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, insurer_name, raw_synonym)
);

CREATE INDEX idx_thesaurus_lookup ON coverage_thesaurus(domain, insurer_name, raw_synonym);
```

#### B. Aislamiento en el Grafo Semántico (`coverage_graph_nodes` & `coverage_graph_edges`)
Las aristas del grafo incorporarán la columna `domain` de manera obligatoria:
```sql
ALTER TABLE coverage_graph_edges 
  ADD COLUMN IF NOT EXISTS domain VARCHAR(50) DEFAULT 'pyme';

CREATE INDEX idx_graph_edges_domain ON coverage_graph_edges(domain, insurer, from_node);
```

---

### 3.2 Servicio de Tesauro por Ramo (`ThesaurusService`)

El servicio de tesauro particionará sus búsquedas y escrituras en memoria (Redis) y base de datos:

* **Estructura de Clave Redis**:
  `thesaurus:${domain}:${insurerName || 'global'}:${hash(rawSynonym)}`
* **Lógica de Lookup**:
  1. Buscar sinónimo específico en `(domain, insurerName)`.
  2. Fallback a sinónimo de ramo global `(domain, 'global')`.
  3. Fallback a motor difuso/embedding con contexto de ramo.

---

### 3.3 Pipeline de Extracción IA (Strategy Pattern)

#### A. Prompt Builder Adaptativo (`DomainPromptStrategy`)
```typescript
export interface DomainPromptStrategy {
  buildExtractionPrompt(params: {
    domain: InsuranceDomain;
    insurers: string[];
    quoteTexts: string[];
    thesaurusHints: Record<string, string>;
  }): string;
  
  getZodSchema(): z.ZodSchema;
}
```

* **Estrategia Autos**: Extrae Prima Anual/Mensual, Deducible RCE, Cobertura Pérdida Total/Parcial, Asistencia en Viaje, Carro Taller, Deducible en SMMLV/Días.
* **Estrategia Copropiedades**: Extrae RCE Áreas Comunes, Directorio & Administradores, Zonas Comunes, Valor Asegurado Edificación (Ley 675).
* **Estrategia PYME**: Mantiene la extracción granular de 14 categorías comerciales.

#### B. Adaptador de Comparación (`comparisonEngineAdapter.ts`)
```typescript
export const comparisonEngineAdapter = {
  async generateComparison(
    pdfPaths: string[], 
    userId: string, 
    domain: InsuranceDomain = 'pyme'
  ): Promise<ComparisonAdapterResult> {
    // 1. Obtener estrategia del ramo
    const strategy = PromptStrategyFactory.getStrategy(domain);
    
    // 2. Obtener tesauro y hints de plantillas para el ramo y aseguradoras
    const templateHints = await templateRegistryService.getHintsForDomain(domain, detectedInsurers);
    
    // 3. Generar prompt y llamar a Gemini V2
    // 4. Transformar matriz con taxonomía del ramo
    // 5. Retornar reporte unificado etiquetado con domain
  }
};
```

---

### 3.4 Motor de Evaluaciones y Scoring (`QuoteScorer`)
El algoritmo de puntaje (0–100) se especialización por ramo:

* **PYME**: Valora amplitud de amparos comerciales, sublímites de RCE y deducibles de terremoto.
* **Autos**: Valora límite de RCE, deducible fijo vs %, inclusión de carro taller y asistencia 24/7.
* **Copropiedades**: Prioriza cumplimiento de seguro obligatorio sobre bienes comunes e incendio/terremoto.

---

## 4. Cambios en el Frontend (UI / UX Architecture)

### 4.1 Formulario de Carga y Selección de Ramo (`DocumentUpload.tsx`)
1. **Selector de Ramo**: Dropdown estilizado con íconos para elegir el ramo antes de cargar los archivos:
   * 🏢 PYME (Comercial / PyME)
   * 🚗 Autos (Individual / Flotas)
   * 🏢 Copropiedades (Edificios / Unidades)
   * 👥 Vida Grupo
   * 🏥 Salud
2. **Selector de Aseguradoras / Auto-Detección**: Lista interactiva para indicar qué aseguradoras se están subiendo (ej. SURA, SBS, Mapfre, AXA, Bolívar) o dejar en "Auto-detectar por IA".

---

### 4.2 Matriz y Reporte Adaptativo (`UnifiedCoverageMatrix.tsx` & `ComparisonReport.tsx`)
* **Dynamic Header Rendering**: Renderiza dinámicamente las secciones y columnas según el `domain` recibido en la respuesta del backend.
* **Badges y Deducibles Específicos**:
  * Para **Autos**: Badges de SMMLV, Días de inmovilización, Porcentajes sin mínimo.
  * Para **PYME**: Badges de SMMLV, Salarios Mínimos, Valores Absolutos COP.

---

### 4.3 Flujo de Corrección Manual HITL (*Human-In-The-Loop*)
Cuando un broker o analista corrige un amparo o deducible desde la pantalla de reporte:
* La llamada a `learningEngine.applyCorrection()` incluirá explícitamente el `domain` activo y la `insurerName`.
* El grafo y el tesauro aprenderán la regla **solo dentro de ese ramo**.

---

## 5. Matriz de Cambios Afectados en la Estructura de Archivos

| Archivo / Componente | Cambios Necesarios | Impacto |
|----------------------|-------------------|---------|
| `server/src/types/domain.ts` | Definición de tipos `InsuranceDomain`, `DomainTaxonomy`, `CoverageCategory`. | **Nuevo** |
| `server/src/config/taxonomies/*.ts` | Definición de taxonomías estándar por ramo (Autos, PYME, Copropiedades, etc.). | **Nuevo** |
| `server/src/controllers/analysisController.ts` | Recibir `domain` de `req.body` y propagar en la respuesta de análisis. | **Medio** |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Aceptar `domain` y delegar a la estrategia de prompt del ramo. | **Alto** |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Refactorizar con `PromptStrategyFactory` para soportar prompts por ramo. | **Alto** |
| `server/src/services/coverageGraphService.ts` | Particionar caché y consultas SQL añadiendo filtro `domain`. | **Alto** |
| `server/src/services/learningEngine.ts` | Guardar correcciones en Tesauro y Grafo con `domain` explícito. | **Medio** |
| `src/components/DocumentUpload.tsx` | Selector visual de Ramo (`domain`) en el formulario de upload. | **Medio** |
| `src/components/UnifiedCoverageMatrix.tsx` | Adaptar renderizado de categorías a la taxonomía dinámica del ramo. | **Alto** |
| `src/components/DeductibleMatrix.tsx` | Formatear deducibles según las reglas del ramo seleccionado. | **Medio** |

---

## 6. Roadmap de Implementación por Fases

### Fase 1: Abstracción de Dominio y Taxonomías (Backend Core)
- [ ] Crear `server/src/types/domain.ts` con definiciones de ramos y categorías.
- [ ] Crear registros de taxonomía para `pyme`, `autos` y `copropiedades`.
- [ ] Migrar las tablas de Supabase (`coverage_thesaurus`, `coverage_graph_edges`) agregando restricciones de `domain`.

### Fase 2: Tesauro por Ramo y Estrategias de Prompt
- [ ] Actualizar `ThesaurusService` para usar la clave `thesaurus:${domain}:${insurer}:${synonym}`.
- [ ] Crear `PromptStrategyFactory` con estrategias específicas para `PymePromptStrategy` y `AutosPromptStrategy`.
- [ ] Adaptar `comparisonPromptBuilder.ts` para invocar la estrategia según el ramo.

### Fase 3: Scoring y Adaptación de Motor de Comparación
- [ ] Adaptar `quoteScorer` para ponderar variables específicas de cada ramo.
- [ ] Actualizar `matrixTransformer.ts` y `flatTableParser.ts` con la taxonomía dinámica.

### Fase 4: Frontend Multiramo y UX
- [ ] Incorporar selector de ramo en `DocumentUpload.tsx`.
- [ ] Actualizar `ComparisonReport.tsx` y `UnifiedCoverageMatrix.tsx` para renderizar categorías dinámicas.
- [ ] Probar la corrección HITL enviando `domain` al backend.

### Fase 5: Verificación, Tests E2E y Despliegue
- [ ] Crear tests unitarios para los nuevos `PromptStrategies` de Autos y Copropiedades.
- [ ] Ejecutar prueba de regresión en PYME (asegurar 100% retrocompatibilidad).
- [ ] Desplegar en staging/producción (Railway) con soporte multiramo activo.
