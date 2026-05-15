import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';

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
  { id: 'patrimoniales', name: 'Patrimoniales', level: 1, childrenIds: ['edificios', 'equipos', 'rotura', 'interrupcion'], aliases: ['Daño Material', 'Propiedad', 'Bienes'], riskType: 'property' },
  { id: 'responsabilidad-civil', name: 'Responsabilidad Civil', level: 1, childrenIds: ['rce', 'rcd'], aliases: ['RC', 'RCE', 'Civil Liability'], riskType: 'liability' },
  { id: 'asistencias', name: 'Asistencias y Servicios', level: 1, childrenIds: ['asistencia-pyme', 'asistencia-legal'], aliases: ['Servicios', 'Asistencia'], riskType: 'assistance' },
  { id: 'riesgos-especiales', name: 'Riesgos Especiales', level: 1, childrenIds: ['terremoto', 'hmacc', 'transporte'], aliases: ['Especiales', 'Catastróficos'], riskType: 'special' },
  
  // Level 2: Sub-families
  { id: 'edificios', name: 'Edificios y Contenidos', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Incendio', 'Edificio', 'Contenidos', 'Inmuebles'], riskType: 'property', typicalDeductible: '10%' },
  { id: 'equipos', name: 'Equipos y Maquinaria', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Equipo Eléctrico', 'Electrónico', 'EEE', 'Maquinaria'], riskType: 'equipment', typicalDeductible: '10%' },
  { id: 'rotura', name: 'Rotura de Maquinaria', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Rotura', 'Daño Interno', 'Máquina'], riskType: 'equipment', typicalDeductible: '10%' },
  { id: 'interrupcion', name: 'Interrupción de Negocio', level: 2, parentId: 'patrimoniales', childrenIds: [], aliases: ['Lucro Cesante', 'Pérdida de Beneficios', 'Interrupción'], riskType: 'business', typicalDeductible: '0%' },
  { id: 'rce', name: 'Responsabilidad Civil Extracontractual', level: 2, parentId: 'responsabilidad-civil', childrenIds: [], aliases: ['RCE', 'RC Extracontractual', 'Daño a Terceros'], riskType: 'liability', typicalDeductible: '0%' },
  { id: 'rcd', name: 'Responsabilidad Civil Contractual', level: 2, parentId: 'responsabilidad-civil', childrenIds: [], aliases: ['RCD', 'RC Contractual'], riskType: 'liability', typicalDeductible: '0%' },
  { id: 'asistencia-pyme', name: 'Asistencia PYME', level: 2, parentId: 'asistencias', childrenIds: [], aliases: ['Asistencia', 'Servicios PYME'], riskType: 'assistance', typicalDeductible: '0%' },
  { id: 'asistencia-legal', name: 'Asistencia Legal', level: 2, parentId: 'asistencias', childrenIds: [], aliases: ['Legal', 'Asesoría Legal'], riskType: 'assistance', typicalDeductible: '0%' },
  { id: 'terremoto', name: 'Terremoto y Eventos Catastróficos', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['Terremoto', 'Sismo', 'Catastróficos', 'Erupción'], riskType: 'catastrophe', typicalDeductible: '10% min 5 SMMLV' },
  { id: 'hmacc', name: 'Huelga, Motín, Asonada', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['HMACC', 'Asonada', 'Motín', 'Huelga'], riskType: 'special', typicalDeductible: '10%' },
  { id: 'transporte', name: 'Transporte', level: 2, parentId: 'riesgos-especiales', childrenIds: [], aliases: ['Transporte Mercancías', 'Transporte Valores', 'Tránsito'], riskType: 'transit', typicalDeductible: '10%' }
];

// Composite coverage patterns
const COMPOSITE_PATTERNS = [
  {
    pattern: /todo\s+riesgo|amparo\s+básico|amparo\s+basico/i,
    components: ['edificios', 'terremoto', 'hmacc', 'sustraccion'],
    confidence: 0.85
  },
  {
    pattern: /daño\s+material|pérdida\s+o\s+daño/i,
    components: ['edificios', 'equipos', 'rotura'],
    confidence: 0.75
  }
];

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
    
    // Generate embedding for raw name
    const rawEmbedding = await embeddingService.generateEmbedding(rawName);
    
    // Calculate similarity with each node
    const similarities: Array<{ groupId: string; confidence: number }> = [];
    
    for (const node of ONTOLOGY_SEED.filter(n => n.level >= 2)) {
      const nodeEmbedding = await embeddingService.generateEmbedding(node.name);
      const similarity = embeddingService.cosineSimilarity(rawEmbedding, nodeEmbedding);
      
      if (similarity > 0.6) {
        similarities.push({
          groupId: node.id,
          confidence: similarity
        });
      }
      
      // Check aliases
      for (const alias of node.aliases) {
        const aliasEmbedding = await embeddingService.generateEmbedding(alias);
        const aliasSimilarity = embeddingService.cosineSimilarity(rawEmbedding, aliasEmbedding);
        
        if (aliasSimilarity > 0.65) {
          similarities.push({
            groupId: node.id,
            confidence: aliasSimilarity
          });
        }
      }
    }
    
    // Sort by confidence and take top 5
    similarities.sort((a, b) => b.confidence - a.confidence);
    const topMatches = similarities.slice(0, 5);
    
    // Calculate overall confidence
    const maxConfidence = topMatches.length > 0 ? topMatches[0].confidence : 0;
    
    return {
      rawName,
      insurerName,
      groups: topMatches,
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
