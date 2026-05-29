import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { getCachedCoverageMapping, setCachedCoverageMapping } from './cache/redisCache';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface OntologyNode {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  childrenIds: string[];
  aliases: string[];
  typicalDeductible?: string;
  riskType: string;
}

export interface CoverageMapping {
  rawName: string;
  insurerName?: string;
  groups: Array<{
    groupId: string;
    confidence: number;
  }>;
  isComposite: boolean;
  components?: string[];
  confidence: number;
  needsHumanReview?: boolean;
  rawTextSnippet?: string;
  justification?: string;
  pageNumber?: number;
}

// Initial ontology structure
const ONTOLOGY_SEED: OntologyNode[] = [
  // Level 1: Families
  { id: 'patrimoniales', name: 'Patrimoniales', level: 1, childrenIds: ['incendio', 'lucro-cesante', 'equipo-electronico', 'rotura-maquinaria', 'sustraccion', 'vidrios', 'manejo'], aliases: ['Daño Material', 'Propiedad', 'Bienes'], riskType: 'property' },
  { id: 'responsabilidad-civil', name: 'Responsabilidad Civil', level: 1, childrenIds: ['rce'], aliases: ['RC', 'RCE', 'Civil Liability'], riskType: 'liability' },
  { id: 'asistencias', name: 'Asistencias y Servicios', level: 1, childrenIds: ['asistencia-pyme', 'asistencia-legal'], aliases: ['Servicios', 'Asistencia'], riskType: 'assistance' },
  { id: 'riesgos-especiales', name: 'Riesgos Especiales', level: 1, childrenIds: ['terremoto', 'hmacc', 'transporte-mercancias', 'transporte-valores'], aliases: ['Especiales', 'Catastróficos'], riskType: 'special' },
  
  // Level 2: Sub-families matching the 14 CANONICAL CATEGORIES exactly
  { id: 'incendio', name: 'Incendio (Edificio y Contenidos)', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Incendio', 'Edificio', 'Contenidos', 'Inmuebles', 'Todo riesgo daños materiales', 'Daños Materiales', 'Amparo Básico', 'Daños por Agua', 'Anegación', 'Inundación', 'Huracan, vientos fuertes, granizo, impacto y humo', 'Vientos Fuertes', 'Granizo', 'Impacto', 'Humo', 'Daño Físico'], riskType: 'property', typicalDeductible: '10%' },
  { id: 'lucro-cesante', name: 'Lucro Cesante', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Lucro Cesante', 'Pérdida de Beneficios', 'Interrupción de Negocio', 'Gastos por Parálisis', 'Interrupción', 'Lucro cesante por daños materiales'], riskType: 'business', typicalDeductible: '0%' },
  { id: 'sustraccion', name: 'Sustracción / Hurto', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Sustracción', 'Hurto', 'Robo', 'Hurto Calificado', 'Hurto Simple', 'Sustracción con Violencia', 'Sustracción sin Violencia', 'Saqueo', 'Hurto calificado', 'Sustracción con violencia', 'Sustracción sin violencia'], riskType: 'theft', typicalDeductible: '10% min 1 SMMLV' },
  { id: 'equipo-electronico', name: 'Equipo Eléctrico y Electrónico', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Equipo Eléctrico', 'Electrónico', 'EEE', 'Equipo Eléctrico y Electrónico', 'Computadores', 'Servidores', 'Daño Interno', 'Cobertura Fuera de Predios', 'Vehículos propios y no propios', 'Responsabilidad profesional por pérdida de datos – Cyber'], riskType: 'equipment', typicalDeductible: '10%' },
  { id: 'rotura-maquinaria', name: 'Rotura de Maquinaria', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Rotura de Maquinaria', 'Rotura', 'Daño Interno de Maquinaria', 'Máquinas', 'Rotura de maquinaria'], riskType: 'equipment', typicalDeductible: '10%' },
  { id: 'rce', name: 'Responsabilidad Civil (RCE)', level: 2, parentId: 'responsabilidad-civil', childrenIds: [], aliases: ['RCE', 'Responsabilidad Civil Extracontractual', 'Daño a Terceros', 'PLO', 'Predios, labores y operaciones', 'Predios, labores y operaciones (PLO)', 'Responsabilidad Civil Productos', 'RC Cruzada', 'Parqueaderos', 'Contratistas o subcontratistas', 'Vehículos propios y no propios', 'Amparo básico daños y perjuicios a terceros', 'Responsabilidad civil patronal', 'Accidentes personales'], riskType: 'liability', typicalDeductible: '0%' },
  { id: 'vidrios', name: 'Vidrios Planos', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Vidrios', 'Placas', 'Cristales', 'Vidrios Planos', 'Vidrios planos'], riskType: 'property', typicalDeductible: '10%' },
  { id: 'manejo', name: 'Manejo Global / Infidelidad', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Manejo', 'Infidelidad', 'Fraude de Empleados', 'Manejo Global', 'Manejo Global Comercial', 'Manejo global comercial', 'Fraude Empleados'], riskType: 'theft', typicalDeductible: '10% min 1 SMMLV' },
  { id: 'transporte-mercancias', name: 'Transporte de Mercancías', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['Transporte de Mercancías', 'Tránsito de Mercancías', 'Transporte', 'Transporte de mercancias'], riskType: 'transit', typicalDeductible: '10%' },
  { id: 'transporte-valores', name: 'Transporte de Valores', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['Transporte de Valores', 'Dinero en Tránsito', 'Valores en Tránsito', 'Dinero Local', 'Transporte de valores'], riskType: 'transit', typicalDeductible: '10%' },
  { id: 'asistencia-pyme', name: 'Asistencia PYME', level: 2, parentId: 'asistencias', childrenIds: [], aliases: ['Asistencia', 'Servicios PYME', 'Servicios de asistencia', 'Asistencia pyme'], riskType: 'assistance', typicalDeductible: '0%' },
  { id: 'asistencia-legal', name: 'Asistencia Legal', level: 2, parentId: 'asistencias', childrenIds: [], aliases: ['Legal', 'Asesoría Legal', 'Asistencia Jurídica', 'Asistencia legal'], riskType: 'assistance', typicalDeductible: '0%' },
  { id: 'terremoto', name: 'Terremoto y Eventos Catastróficos', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['Terremoto', 'Sismo', 'Catastróficos', 'Erupción', 'Terremoto y Eventos Catastróficos', 'Terremoto, maremoto o tsunami, temblor o erupción volcánica', 'Terremoto y eventos catastrificos', 'Terremoto y eventos catastróficos'], riskType: 'catastrophe', typicalDeductible: '10% min 5 SMMLV' },
  { id: 'hmacc', name: 'Huelga, Motín, Asonada (HMACC)', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['HMACC', 'Asonada', 'Motín', 'Huelga', 'Huelga, Motín, Asonada', 'Huelga, Motín, Asonada (HMACC)', 'Actos mal intencionados de terceros'], riskType: 'special', typicalDeductible: '10%' }
];

// Composite coverage patterns
const COMPOSITE_PATTERNS = [
  {
    pattern: /todo\s+riesgo|amparo\s+básico|amparo\s+basico/i,
    components: ['incendio', 'terremoto', 'hmacc', 'sustraccion'],
    confidence: 0.85
  },
  {
    pattern: /daño\s+material|pérdida\s+o\s+daño/i,
    components: ['incendio', 'equipo-electronico', 'rotura-maquinaria'],
    confidence: 0.75
  }
];

// Cache in-memory for static ontology embeddings to eliminate HTTP overhead
let ontologyEmbeddingsCache: Map<string, number[]> | null = null;
let isInitializingCache = false;

/**
 * Ensures that ontology node and alias embeddings are pre-calculated in batch
 */
async function ensureOntologyEmbeddingsCache(): Promise<Map<string, number[]>> {
  if (ontologyEmbeddingsCache) return ontologyEmbeddingsCache;
  if (isInitializingCache) {
    // Wait briefly if initialization is already in progress
    await new Promise(resolve => setTimeout(resolve, 500));
    if (ontologyEmbeddingsCache) return ontologyEmbeddingsCache;
  }
  
  isInitializingCache = true;
  console.log('🧠 [Ontology] Initializing static embeddings cache...');
  const cache = new Map<string, number[]>();
  
  const textsToEmbed: string[] = [];
  for (const node of ONTOLOGY_SEED.filter(n => n.level >= 2)) {
    textsToEmbed.push(node.name);
    for (const alias of node.aliases) {
      textsToEmbed.push(alias);
    }
  }
  
  const uniqueTexts = Array.from(new Set(textsToEmbed));
  
  try {
    const results = await embeddingService.generateEmbeddingsBatch(uniqueTexts);
    for (const res of results) {
      cache.set(res.text, res.embedding);
    }
    console.log(`✅ [Ontology] Static embeddings cache initialized with ${cache.size} embeddings`);
    ontologyEmbeddingsCache = cache;
  } catch (error: any) {
    console.error('❌ [Ontology] Failed to pre-calculate embeddings in batch:', error.message);
    // Fallback: populate on-demand in mapCoverage
    ontologyEmbeddingsCache = cache;
  } finally {
    isInitializingCache = false;
  }
  
  return ontologyEmbeddingsCache;
}

/**
 * Safe JSON parser utility that removes markdown formatting
 */
function parseJSONSafe(text: string): any {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Runs stateless, memory-isolated double-agent consensus between Taxonomist and Critic
 */
async function runConsensus(rawName: string): Promise<{
  groupId: string;
  confidence: number;
  justification: string;
  needsHumanReview: boolean;
}> {
  if (!GEMINI_API_KEY) {
    return {
      groupId: 'EXCLUSIVE',
      confidence: 0,
      justification: 'Gemini API key not configured',
      needsHumanReview: true
    };
  }

  try {
    const canonicalCategoriesList = ONTOLOGY_SEED.filter(n => n.level >= 2);
    
    // Import learningEngine dynamically to prevent circular dependencies
    const { learningEngine } = await import('./learningEngine');
    
    // Fetch top 3 past human corrections as dynamic few-shots (Task 5.2 & 5.3)
    const examples = await learningEngine.getSimilarCorrections(rawName);
    let fewShotContext = '';
    if (examples && examples.length > 0) {
      fewShotContext = `\nAquí tienes algunos ejemplos de cómo un suscriptor experto humano ha clasificado coberturas similares anteriormente:\n` +
        examples.map((ex: any) => `- Cobertura original: "${ex.raw_name}" -> Categoría asignada: "${ex.canonical_name}"`).join('\n') + '\n';
    }

    // 1. Taxonomist Agent (Agent A) Prompt
    const taxonomistPrompt = `Actúas como un suscriptor de seguros PYME experto (Agente Taxónomo).
Tu tarea es analizar la siguiente cobertura extraída de un documento de seguro y proponer a cuál de las categorías canónicas pertenece semántica y legalmente.

Cobertura del documento a clasificar: "${rawName}"
${fewShotContext}
Categorías canónicas disponibles:
${canonicalCategoriesList.map(c => `- ID: "${c.id}" (${c.name}). Sinónimos/Alias comunes: ${c.aliases.join(', ')}`).join('\n')}

Instrucciones de clasificación:
1. Elige exactamente uno de los IDs de las categorías canónicas si y solo si la cobertura pertenece semántica o legalmente a ese grupo con alta certeza (90%+).
2. Si la cobertura es "exótica", exclusiva, sumamente específica de un ramo que no encaja en ninguna categoría canónica (ej. avería de maquinaria de refrigeración muy específica sin categoría general aplicable, o amparos raros de cyber específicos), responde con "EXCLUSIVE".
3. Responde únicamente en formato JSON con la siguiente estructura:
{
  "proposedGroupId": "id_de_la_categoria_o_EXCLUSIVE",
  "justification": "Breve explicación técnica de 1-2 frases de por qué pertenece a esta categoría o por qué es EXCLUSIVE."
}

Tu respuesta debe ser un JSON válido, sin bloques de código markdown, solo el objeto JSON.`;

    const modelName = env.GEMINI_MODEL || 'gemini-3.5-flash';
    console.log(`🤖 [Consensus] Agent A (Taxonomist) evaluating: "${rawName}" using ${modelName}`);

    // Call Agent A
    const agentAResult = await genAI.models.generateContent({
      model: modelName,
      contents: taxonomistPrompt,
      config: { temperature: 0.1 }
    });

    const parsedA = parseJSONSafe(agentAResult.text || '');
    if (!parsedA || !parsedA.proposedGroupId) {
      throw new Error(`Invalid response from Taxonomist Agent: ${agentAResult.text}`);
    }

    const proposedGroupId = parsedA.proposedGroupId;
    const taxonomistJustification = parsedA.justification || '';
    
    console.log(`🤖 [Consensus] Agent A proposed: "${proposedGroupId}" - Reason: "${taxonomistJustification}"`);

    // 2. Critic Agent (Agent B) Prompt in isolated, stateless context
    const proposedNode = ONTOLOGY_SEED.find(n => n.id === proposedGroupId);
    const proposedName = proposedNode ? proposedNode.name : proposedGroupId;

    const criticPrompt = `Actúas como un Crítico de Suscripción de Seguros PYME (Agente Crítico).
Tu única función es auditar y desafiar de manera rigurosa la propuesta de clasificación realizada por otro agente (el Taxónomo).
Debes prevenir falsos positivos, clasificaciones forzadas o alucinaciones.

Cobertura original del documento: "${rawName}"
Propuesta del Taxónomo: clasificar esta cobertura en la categoría ID "${proposedGroupId}" (${proposedName})
Justificación del Taxónomo: "${taxonomistJustification}"

Categorías canónicas disponibles en el sistema:
${canonicalCategoriesList.map(c => `- ID: "${c.id}" (${c.name}). Sinónimos/Alias comunes: ${c.aliases.join(', ')}`).join('\n')}

Instrucciones de auditoría:
- Analiza críticamente si la cobertura original realmente equivale o encaja de forma técnica y legal en la propuesta "${proposedGroupId}".
- Desafía la propuesta. ¿Es una clasificación forzada? Por ejemplo, una cobertura exótica de "Pérdida de Alimentos por Frío" NO debería forzarse dentro de "Incendio" solo porque es un "daño material". Debería ser clasificada como "EXCLUSIVE" si no hay una categoría de congelación específica.
- Si la clasificación del Taxónomo es correcta e inapelable (ej. "Daños por humo" en "incendio" es correcto), entonces apruébala.
- Si no es correcta, desapruébala y sugiere la categoría correcta (o "EXCLUSIVE" si no encaja en ninguna).

Responde únicamente en formato JSON con la siguiente estructura:
{
  "approved": true o false,
  "alternativeGroupId": "ID_de_categoria_alternativa_o_EXCLUSIVE_o_null",
  "reason": "Justificación crítica y detallada de 1-2 frases de tu decisión de aprobar o rechazar la propuesta."
}

Tu respuesta debe ser un JSON válido, sin bloques de código markdown, solo el objeto JSON.`;

    console.log(`🤖 [Consensus] Agent B (Critic) auditing proposal: "${proposedGroupId}"`);

    const agentBResult = await genAI.models.generateContent({
      model: modelName,
      contents: criticPrompt,
      config: { temperature: 0.3 }
    });

    const parsedB = parseJSONSafe(agentBResult.text || '');
    if (!parsedB) {
      throw new Error(`Invalid response from Critic Agent: ${agentBResult.text}`);
    }

    const approved = parsedB.approved === true;
    const alternativeGroupId = parsedB.alternativeGroupId;
    const criticReason = parsedB.reason || '';

    console.log(`🤖 [Consensus] Agent B verdict: ${approved ? 'APPROVED' : 'DISAGREED'} - Critic Reason: "${criticReason}"`);

    // Local Conciliation Engine (Task 3.3 & 3.4)
    if (approved) {
      return {
        groupId: proposedGroupId,
        confidence: 0.95,
        justification: `Consenso alcanzado. Taxónomo: ${taxonomistJustification}. Crítico aprobó: ${criticReason}.`,
        needsHumanReview: false
      };
    } else {
      const finalGroup = (alternativeGroupId && alternativeGroupId !== 'null') ? alternativeGroupId : proposedGroupId;
      console.warn(`⚠️ [Consensus] Disagreement between agents for "${rawName}". Proposed: "${proposedGroupId}", Suggested Alternative: "${alternativeGroupId}". Triggering human audit.`);
      
      return {
        groupId: finalGroup,
        confidence: 0.50,
        justification: `Discrepancia detectada. Taxónomo propuso "${proposedGroupId}" (${taxonomistJustification}). Crítico rechazó: ${criticReason}. Sugirió alternativa: "${alternativeGroupId}".`,
        needsHumanReview: true
      };
    }

  } catch (error: any) {
    console.error('❌ [Consensus] Error during double-agent consensus:', error.message);
    return {
      groupId: 'EXCLUSIVE',
      confidence: 0,
      justification: `Error en el flujo de consenso de agentes: ${error.message}`,
      needsHumanReview: true
    };
  }
}

export const coverageOntology = {
  /**
   * Get all ontology nodes
   */
  getNodes(): OntologyNode[] {
    return ONTOLOGY_SEED;
  },

  /**
   * Get node by ID
   */
  getNodeById(id: string): OntologyNode | undefined {
    return ONTOLOGY_SEED.find(n => n.id === id);
  },

  /**
   * Find nodes by name or alias
   */
  findNodesByName(name: string): OntologyNode[] {
    const normalized = name.toLowerCase();
    return ONTOLOGY_SEED.filter(n => 
      n.name.toLowerCase().includes(normalized) ||
      n.aliases.some(a => a.toLowerCase().includes(normalized))
    );
  },

  /**
   * Map raw coverage name to semantic groups with probabilities
   */
  async mapCoverage(
    rawName: string,
    insurerName?: string
  ): Promise<CoverageMapping> {
    console.log(`🧠 [Ontology] Mapping: "${rawName}"`);
    
    // Task 3.5: Fast cache lookup using Redis/Memory Cache
    const cached = await getCachedCoverageMapping(rawName, insurerName);
    if (cached) {
      console.log(`⚡ [Ontology Cache] Hit for "${rawName}":`, cached);
      return cached;
    }

    // Try DB lookup first
    try {
      const { data, error } = await supabase
        .from('coverage_mappings')
        .select('*')
        .eq('raw_name', rawName)
        .eq('insurer_name', insurerName || '')
        .limit(1);

      if (data && data.length > 0) {
        const record = data[0] as any;
        console.log(`📦 [Ontology DB] Hit for "${rawName}" -> "${record.canonical_name}"`);
        
        const mapping: CoverageMapping = {
          rawName,
          insurerName,
          groups: record.canonical_name ? [{ groupId: record.canonical_name, confidence: record.confidence }] : [],
          isComposite: record.is_composite,
          confidence: record.confidence,
          needsHumanReview: record.needs_human_review,
          rawTextSnippet: record.raw_text_snippet,
          justification: record.ai_justification,
          pageNumber: record.page_number
        };

        // Cache for future lookups
        await setCachedCoverageMapping(rawName, mapping, insurerName);
        return mapping;
      }
    } catch (dbErr) {
      console.warn('⚠️ [Ontology DB] Lookup error, falling back to consensus:', dbErr);
    }
    
    // Check for composite patterns
    const isComposite = COMPOSITE_PATTERNS.some(p => p.pattern.test(rawName));
    
    if (isComposite) {
      const match = COMPOSITE_PATTERNS.find(p => p.pattern.test(rawName));
      const mapping = {
        rawName,
        insurerName,
        groups: match!.components.map(id => ({
          groupId: id,
          confidence: match!.confidence
        })),
        isComposite: true,
        components: match!.components,
        confidence: match!.confidence
      };

      await setCachedCoverageMapping(rawName, mapping, insurerName);
      return mapping;
    }

    // Call Double-Agent Consensus flow for high certainty mapping
    const consensus = await runConsensus(rawName);

    let groups: Array<{ groupId: string; confidence: number }> = [];
    if (consensus.groupId !== 'EXCLUSIVE') {
      groups = [{ groupId: consensus.groupId, confidence: consensus.confidence }];
    }

    const mapping: CoverageMapping = {
      rawName,
      insurerName,
      groups,
      isComposite: false,
      confidence: consensus.groupId === 'EXCLUSIVE' ? 0 : consensus.confidence,
      needsHumanReview: consensus.needsHumanReview,
      justification: consensus.justification,
    };

    // Save and cache the result
    await this.saveMapping(mapping);
    await setCachedCoverageMapping(rawName, mapping, insurerName);

    return mapping;
  },

  /**
   * Group coverages by semantic similarity
   */
  async groupCoverages(
    coverages: Array<{ name: string; insurerName: string }>
  ): Promise<Array<{
    groupName: string;
    coverages: Array<{ name: string; insurerName: string; confidence: number }>;
  }>> {
    const groups: Record<string, Array<{ name: string; insurerName: string; confidence: number }>> = {};
    
    for (const coverage of coverages) {
      const mapping = await this.mapCoverage(coverage.name, coverage.insurerName);
      
      if (mapping.groups.length > 0) {
        const bestGroup = mapping.groups[0];
        const node = this.getNodeById(bestGroup.groupId);
        
        if (node) {
          const groupName = node.name;
          
          if (!groups[groupName]) {
            groups[groupName] = [];
          }
          
          groups[groupName].push({
            name: coverage.name,
            insurerName: coverage.insurerName,
            confidence: bestGroup.confidence
          });
        }
      }
    }
    
    return Object.entries(groups).map(([groupName, coverages]) => ({
      groupName,
      coverages
    }));
  },

  /**
   * Get typical deductible for a coverage type
   */
  getTypicalDeductible(groupId: string): string | undefined {
    const node = this.getNodeById(groupId);
    return node?.typicalDeductible;
  },

  /**
   * Save mapping to database for learning with fallback
   */
  async saveMapping(mapping: CoverageMapping): Promise<void> {
    try {
      // Intento 1: Guardar con las nuevas columnas de alta certeza
      const { error } = await supabase
        .from('coverage_mappings')
        .upsert({
          raw_name: mapping.rawName,
          insurer_name: mapping.insurerName || '',
          canonical_name: mapping.groups[0]?.groupId || null,
          semantic_tags: mapping.groups.map(g => g.groupId),
          confidence: mapping.confidence,
          is_composite: mapping.isComposite,
          components: mapping.components || null,
          raw_text_snippet: mapping.rawTextSnippet || null,
          ai_justification: mapping.justification || null,
          page_number: mapping.pageNumber || null,
          needs_human_review: mapping.needsHumanReview || false,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any);

      if (error) {
        // Fallback: guardar solo columnas estándar en caso de que falten en el esquema
        console.warn('⚠️ [Ontology DB] Schema columns missing, falling back to standard columns:', error.message);
        const { error: fallbackError } = await supabase
          .from('coverage_mappings')
          .upsert({
            raw_name: mapping.rawName,
            insurer_name: mapping.insurerName || '',
            canonical_name: mapping.groups[0]?.groupId || null,
            semantic_tags: mapping.groups.map(g => g.groupId),
            confidence: mapping.confidence,
            is_composite: mapping.isComposite,
            components: mapping.components || null,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any);
        
        if (fallbackError) {
          throw fallbackError;
        }
      }
      console.log(`🌳 [Ontology DB] Saved mapping for "${mapping.rawName}"`);
    } catch (error) {
      console.error('❌ [Ontology DB] Failed to save mapping:', error);
    }
  }
};

export default coverageOntology;

