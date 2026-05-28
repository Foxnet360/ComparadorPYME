import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

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
 * Ask LLM to act as a judge to resolve ambiguous matches (grey area: 0.65 - 0.85 confidence)
 */
async function askJudge(rawName: string, candidates: Array<{ id: string; name: string }>): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `Actúas como un suscriptor experto en seguros PYME en Colombia.
Tu tarea es decidir si la cobertura dada pertenece semántica y legalmente a uno de los siguientes grupos canónicos, o si es un amparo exótico/exclusivo independiente.

Cobertura del documento: "${rawName}"

Candidatos canónicos posibles:
${candidates.map((c, i) => `${i + 1}. [ID: ${c.id}] ${c.name}`).join('\n')}

Instrucciones:
- Analiza con precisión técnica si la cobertura del documento es sinónimo o equivale al 90%+ a uno de los candidatos canónicos.
- Ej: "Daños por humo" equivale a "Edificios y Contenidos" (Amparo Básico).
- Ej: "Pérdida de Alimentos por Frío" para un restaurante es una cobertura exótica de congelación, si no está el candidato de congelación no la unas a un amparo genérico si desvirtúa su valor.
- Si corresponde a un candidato, responde únicamente con el ID del candidato en el formato exacto.
- Si NO corresponde a ningún candidato (es exótica/exclusiva), responde únicamente con "EXCLUSIVE".

Respuesta (sólo escribe el ID o "EXCLUSIVE"):`;

    const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    const answer = result.text?.trim();
    if (answer && candidates.some(c => c.id === answer)) {
      console.log(`⚖️ [Ontology Judge] Assigned "${rawName}" to group: ${answer}`);
      return answer;
    }
    console.log(`⚖️ [Ontology Judge] Deemed "${rawName}" as EXCLUSIVE`);
    return null;
  } catch (error) {
    console.error('❌ [Ontology Judge] Error in judge call:', error);
    return null;
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
    
    // Check for composite patterns
    const isComposite = COMPOSITE_PATTERNS.some(p => p.pattern.test(rawName));
    
    if (isComposite) {
      const match = COMPOSITE_PATTERNS.find(p => p.pattern.test(rawName));
      return {
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
    }
    
    // Ensure cache is loaded
    const cache = await ensureOntologyEmbeddingsCache();
    
    // Generate embedding for raw name
    const rawEmbedding = await embeddingService.generateEmbedding(rawName);
    
    // Calculate similarity with each node using pre-computed embeddings
    const similarities: Array<{ groupId: string; confidence: number }> = [];
    
    for (const node of ONTOLOGY_SEED.filter(n => n.level >= 2)) {
      let nodeEmbedding = cache.get(node.name);
      if (!nodeEmbedding) {
        nodeEmbedding = await embeddingService.generateEmbedding(node.name);
        cache.set(node.name, nodeEmbedding);
      }
      
      const similarity = embeddingService.cosineSimilarity(rawEmbedding, nodeEmbedding);
      
      if (similarity > 0.6) {
        similarities.push({
          groupId: node.id,
          confidence: similarity
        });
      }
      
      // Check aliases
      for (const alias of node.aliases) {
        let aliasEmbedding = cache.get(alias);
        if (!aliasEmbedding) {
          aliasEmbedding = await embeddingService.generateEmbedding(alias);
          cache.set(alias, aliasEmbedding);
        }
        
        const aliasSimilarity = embeddingService.cosineSimilarity(rawEmbedding, aliasEmbedding);
        
        if (aliasSimilarity > 0.65) {
          similarities.push({
            groupId: node.id,
            confidence: aliasSimilarity
          });
        }
      }
    }
    
    // Sort by confidence and take top matches
    similarities.sort((a, b) => b.confidence - a.confidence);
    
    // Deduplicate by groupId
    const seenGroups = new Set<string>();
    const deduplicatedSimilarities = similarities.filter(s => {
      if (seenGroups.has(s.groupId)) return false;
      seenGroups.add(s.groupId);
      return true;
    });
    
    const topMatches = deduplicatedSimilarities.slice(0, 5);
    let maxConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;
    let finalMatches = topMatches;
    
    // LLM-as-a-Judge for grey areas (confidence 0.65 to 0.85) to refine mapping
    if (maxConfidence >= 0.65 && maxConfidence < 0.85 && topMatches.length > 1) {
      const candidates = topMatches.map(m => ({
        id: m.groupId,
        name: this.getNodeById(m.groupId)?.name || m.groupId
      }));
      
      const judgeDecision = await askJudge(rawName, candidates);
      if (judgeDecision) {
        // Rearrange to put the judged node first with higher confidence
        finalMatches = topMatches.map(m => {
          if (m.groupId === judgeDecision) {
            return { groupId: m.groupId, confidence: Math.max(m.confidence, 0.88) };
          }
          return m;
        }).sort((a, b) => b.confidence - a.confidence);
        maxConfidence = finalMatches[0].confidence;
      }
    }
    
    // Fluid Ontology: If confidence is very low (< 0.62), we don't force a category mapping.
    // It remains ungrouped and is automatically treated as an "Amparo Exclusivo" by the comparator.
    if (maxConfidence < 0.62) {
      console.log(`ℹ️ [Ontology] "${rawName}" classified as EXCLUSIVE coverage (confidence ${maxConfidence.toFixed(3)})`);
      return {
        rawName,
        insurerName,
        groups: [],
        isComposite: false,
        confidence: 0
      };
    }
    
    return {
      rawName,
      insurerName,
      groups: finalMatches,
      isComposite: false,
      confidence: maxConfidence
    };
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
   * Save mapping to database for learning
   */
  async saveMapping(mapping: CoverageMapping): Promise<void> {
    try {
      await supabase
        .from('coverage_mappings')
        .upsert({
          raw_name: mapping.rawName,
          insurer_name: mapping.insurerName,
          canonical_name: mapping.groups[0]?.groupId,
          semantic_tags: mapping.groups.map(g => g.groupId),
          confidence: mapping.confidence,
          is_composite: mapping.isComposite,
          last_updated: new Date().toISOString()
        } as any);
    } catch (error) {
      console.error('❌ [Ontology] Failed to save mapping:', error);
    }
  }
};

export default coverageOntology;

