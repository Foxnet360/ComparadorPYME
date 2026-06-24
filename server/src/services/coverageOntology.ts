import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';
import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env';
import { getCachedCoverageMapping, setCachedCoverageMapping } from './cache/redisCache';
import { calculateSimilarity } from '../utils/stringUtils';
import { mapCoverageName } from './thesaurusMapper';
import { coverageGraphService } from './coverageGraphService';



const GEMINI_API_KEY = env.GEMINI_API_KEY || '';
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

import { assertOntologyBundle } from '../schemas/domainBundleSchema';
import { loadDomainJson } from './domainBundleLoader';

interface CompositePattern {
  pattern: RegExp;
  components: string[];
  confidence: number;
}

// Cache por dominio
const ontologyCache = new Map<string, OntologyNode[]>();
const compositePatternsCache = new Map<string, CompositePattern[]>();

function loadOntology(domain: string = 'pyme'): { nodes: OntologyNode[]; compositePatterns: CompositePattern[] } {
  if (ontologyCache.has(domain) && compositePatternsCache.has(domain)) {
    return {
      nodes: ontologyCache.get(domain)!,
      compositePatterns: compositePatternsCache.get(domain)!,
    };
  }

  const bundle = assertOntologyBundle(loadDomainJson(domain, 'ontology.json'));

  const nodes = bundle.nodes.map(n => ({ ...n, level: n.level as 1 | 2 | 3 }));
  const compositePatterns = (bundle.compositePatterns || []).map(p => ({
    pattern: new RegExp(p.pattern, 'i'),
    components: p.components,
    confidence: p.confidence,
  }));

  ontologyCache.set(domain, nodes);
  compositePatternsCache.set(domain, compositePatterns);
  return { nodes, compositePatterns };
}

// Cache in-memory for static ontology embeddings to eliminate HTTP overhead
const ontologyEmbeddingsCache = new Map<string, Map<string, number[]>>();
const isInitializingCache = new Map<string, boolean>();

/**
 * Ensures that ontology node and alias embeddings are pre-calculated in batch
 */
async function ensureOntologyEmbeddingsCache(domain: string = 'pyme'): Promise<Map<string, number[]>> {
  if (ontologyEmbeddingsCache.has(domain)) return ontologyEmbeddingsCache.get(domain)!;
  if (isInitializingCache.get(domain)) {
    // Wait briefly if initialization is already in progress
    await new Promise(resolve => setTimeout(resolve, 500));
    if (ontologyEmbeddingsCache.has(domain)) return ontologyEmbeddingsCache.get(domain)!;
  }

  isInitializingCache.set(domain, true);
  console.log('🧠 [Ontology] Initializing static embeddings cache...');
  const cache = new Map<string, number[]>();

  const { nodes } = loadOntology(domain);
  const textsToEmbed: string[] = [];
  for (const node of nodes.filter(n => n.level >= 2)) {
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
    ontologyEmbeddingsCache.set(domain, cache);
  } catch (error: any) {
    console.error('❌ [Ontology] Failed to pre-calculate embeddings in batch:', error.message);
    // Fallback: populate on-demand in mapCoverage
    ontologyEmbeddingsCache.set(domain, cache);
  } finally {
    isInitializingCache.set(domain, false);
  }

  return ontologyEmbeddingsCache.get(domain)!;
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
 * Local fast deterministic/fuzzy matching against static seed ontology
 */
function localOntologyMatch(
  rawName: string,
  domain: string = 'pyme'
): { groupId: string; confidence: number; justification: string } | null {
  // Clean rawName of parenthetical suffixes (e.g. "(Sublímite)", "(Rider)")
  const cleanedRawName = rawName
    .replace(/\(sub-?l[ií]mite\)/ig, '')
    .replace(/\(l[ií]mite\)/ig, '')
    .replace(/\(amparo\)/ig, '')
    .replace(/\(rider\)/ig, '')
    .replace(/\(gastos\)/ig, '')
    .replace(/\(extensi[oó]n\)/ig, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedRaw = cleanedRawName.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents/tildes
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedRaw) return null;

  const { nodes } = loadOntology(domain);
  let bestNode: OntologyNode | null = null;
  let maxSimilarity = 0;
  let matchReason = '';

  for (const node of nodes.filter(n => n.level >= 2)) {
    // Check node name
    const normalizedName = node.name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedRaw === normalizedName) {
      return {
        groupId: node.id,
        confidence: 0.98,
        justification: `Coincidencia exacta local con la categoría canónica "${node.name}"`
      };
    }

    // Check aliases
    for (const alias of node.aliases) {
      const normalizedAlias = alias.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (normalizedRaw === normalizedAlias) {
        return {
          groupId: node.id,
          confidence: 0.95,
          justification: `Coincidencia exacta local con el alias "${alias}" de la categoría "${node.name}"`
        };
      }

      // Check similarity
      const sim = calculateSimilarity(normalizedRaw, normalizedAlias);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestNode = node;
        matchReason = `Coincidencia difusa local (${Math.round(sim * 100)}%) con el alias "${alias}" de la categoría "${node.name}"`;
      }
    }

    // Check similarity on canonical name
    const simName = calculateSimilarity(normalizedRaw, normalizedName);
    if (simName > maxSimilarity) {
      maxSimilarity = simName;
      bestNode = node;
      matchReason = `Coincidencia difusa local (${Math.round(simName * 100)}%) con la categoría canónica "${node.name}"`;
    }
  }

  // If similarity is extremely high (>= 90%), return it immediately
  if (maxSimilarity >= 0.90 && bestNode) {
    return {
      groupId: bestNode.id,
      confidence: maxSimilarity,
      justification: matchReason
    };
  }

  // Try to match using the thesaurus to resolve main and sub-limits
  try {
    const thesaurusMatch = mapCoverageName(cleanedRawName, 0.7, domain);
    if (thesaurusMatch && thesaurusMatch.confidence >= 0.7) {
      // Resolve parent coverage or canonical name to ontology node
      let targetName = thesaurusMatch.canonicalName;

      // If it's a sub-limit or extension and has a parent coverage, try to map that parent first
      if (thesaurusMatch.parentCoverage) {
        const parentMatch = mapCoverageName(thesaurusMatch.parentCoverage, 0.7, domain);
        if (parentMatch && parentMatch.confidence >= 0.7) {
          targetName = parentMatch.canonicalName;
        } else {
          targetName = thesaurusMatch.parentCoverage;
        }
      }

      // Find node by name in ontology (case and accent insensitive)
      const normalizedTarget = targetName.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const node = nodes.find(n => {
        const normalizedNodeName = n.name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (normalizedNodeName === normalizedTarget) return true;
        
        return n.aliases.some(a => {
          const normalizedAlias = a.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return normalizedAlias === normalizedTarget;
        });
      });
      
      if (node) {
        return {
          groupId: node.id,
          confidence: Math.max(0.90, thesaurusMatch.confidence),
          justification: `Coincidencia resuelta vía tesauro/sub-límites: "${thesaurusMatch.canonicalName}" maps to "${node.name}"`
        };
      }
    }
  } catch (e) {
    console.warn('⚠️ [Ontology LocalMatch] Thesaurus lookup failed:', e);
  }

  return null;
}

/**
 * Query the coverage semantic graph before falling back to LLM consensus.
 * Returns a mapping if the best graph result exceeds the confidence threshold.
 */
async function queryGraphForMapping(
  rawName: string,
  insurerName: string | undefined,
  domain: string = 'pyme',
  threshold: number = 0.7
): Promise<CoverageMapping | null> {
  try {
    const graphResult = await coverageGraphService.query(rawName, {
      insurer: insurerName,
      domain,
    });

    if (graphResult.mappings.length === 0) {
      return null;
    }

    const best = graphResult.mappings[0];
    if (best.confidence < threshold) {
      return null;
    }

    const node = coverageOntology.getNodeById(best.canonicalId, domain);
    const groupId = node ? node.id : best.canonicalId;

    return {
      rawName,
      insurerName,
      groups: graphResult.mappings.map((m) => ({
        groupId: coverageOntology.getNodeById(m.canonicalId, domain)?.id ?? m.canonicalId,
        confidence: m.confidence,
      })),
      isComposite: graphResult.composite,
      components: graphResult.components,
      confidence: best.confidence,
      needsHumanReview: best.confidence < 0.85,
      justification: `Graph consensus via ${best.provenance} (confidence ${Math.round(best.confidence * 100)}%)`,
    };
  } catch (error: any) {
    console.warn(`⚠️ [Ontology Graph] Query failed for "${rawName}": ${error.message}`);
    return null;
  }
}

/**
 * Runs stateless, memory-isolated double-agent consensus between Taxonomist and Critic
 */

async function runConsensus(
  rawName: string,
  domain: string = 'pyme'
): Promise<{
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
    const { nodes } = loadOntology(domain);
    const canonicalCategoriesList = nodes.filter(n => n.level >= 2);
    
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

    const TaxonomistResponseSchema = {
      type: Type.OBJECT,
      properties: {
        proposedGroupId: { type: Type.STRING },
        justification: { type: Type.STRING }
      },
      required: ["proposedGroupId", "justification"]
    };

    const CriticResponseSchema = {
      type: Type.OBJECT,
      properties: {
        approved: { type: Type.BOOLEAN },
        alternativeGroupId: { type: Type.STRING, nullable: true },
        reason: { type: Type.STRING }
      },
      required: ["approved", "alternativeGroupId", "reason"]
    };

    // Call Agent A
    const agentAResult = await genAI.models.generateContent({
      model: modelName,
      contents: taxonomistPrompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: TaxonomistResponseSchema
      }
    });

    const parsedA = parseJSONSafe(agentAResult.text || '');
    if (!parsedA || !parsedA.proposedGroupId) {
      throw new Error(`Invalid response from Taxonomist Agent: ${agentAResult.text}`);
    }

    const proposedGroupId = parsedA.proposedGroupId;
    const taxonomistJustification = parsedA.justification || '';
    
    console.log(`🤖 [Consensus] Agent A proposed: "${proposedGroupId}" - Reason: "${taxonomistJustification}"`);

    // 2. Critic Agent (Agent B) Prompt in isolated, stateless context
    const proposedNode = nodes.find(n => n.id === proposedGroupId);
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
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: CriticResponseSchema
      }
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
   * Get all ontology nodes for a domain
   */
  getNodes(domain?: string): OntologyNode[] {
    return loadOntology(domain ?? 'pyme').nodes;
  },

  /**
   * Get node by ID for a domain
   */
  getNodeById(id: string, domain?: string): OntologyNode | undefined {
    return loadOntology(domain ?? 'pyme').nodes.find(n => n.id === id);
  },

  /**
   * Find nodes by name or alias for a domain
   */
  findNodesByName(name: string, domain?: string): OntologyNode[] {
    const normalized = name.toLowerCase();
    return loadOntology(domain ?? 'pyme').nodes.filter(n =>
      n.name.toLowerCase().includes(normalized) ||
      n.aliases.some(a => a.toLowerCase().includes(normalized))
    );
  },

  /**
   * Map raw coverage name to semantic groups with probabilities
   */
  async mapCoverage(
    rawName: string,
    insurerName?: string,
    domain?: string
  ): Promise<CoverageMapping> {
    const d = domain ?? 'pyme';
    console.log(`🧠 [Ontology] Mapping: "${rawName}" domain: ${d}`);

    // Task 3.5: Fast cache lookup using Redis/Memory Cache
    const cached = await getCachedCoverageMapping(rawName, insurerName);
    if (cached) {
      console.log(`⚡ [Ontology Cache] Hit for "${rawName}":`, cached);
      return cached;
    }

    // Try fast local match first to eliminate DB/LLM overhead for standard names
    const localMatch = localOntologyMatch(rawName, d);
    if (localMatch) {
      console.log(`⚡ [Ontology LocalMatch] Hit for "${rawName}" -> "${localMatch.groupId}" (${Math.round(localMatch.confidence * 100)}%)`);
      const mapping: CoverageMapping = {
        rawName,
        insurerName,
        groups: [{ groupId: localMatch.groupId, confidence: localMatch.confidence }],
        isComposite: false,
        confidence: localMatch.confidence,
        needsHumanReview: false,
        justification: localMatch.justification
      };
      // Cache it for future fast lookups
      await setCachedCoverageMapping(rawName, mapping, insurerName);
      return mapping;
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
    const { compositePatterns } = loadOntology(d);
    const isComposite = compositePatterns.some(p => p.pattern.test(rawName));

    if (isComposite) {
      const match = compositePatterns.find(p => p.pattern.test(rawName));
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

    // Query coverage semantic graph before expensive LLM consensus
    const graphMapping = await queryGraphForMapping(rawName, insurerName, d);
    if (graphMapping) {
      console.log(`🌐 [Ontology Graph] Hit for "${rawName}" -> "${graphMapping.groups[0]?.groupId}" (${Math.round(graphMapping.confidence * 100)}%)`);
      await setCachedCoverageMapping(rawName, graphMapping, insurerName);
      return graphMapping;
    }

    // Call Double-Agent Consensus flow for high certainty mapping
    const consensus = await runConsensus(rawName, d);

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
    coverages: Array<{ name: string; insurerName: string }>,
    domain?: string
  ): Promise<Array<{
    groupName: string;
    coverages: Array<{ name: string; insurerName: string; confidence: number }>;
  }>> {
    const groups: Record<string, Array<{ name: string; insurerName: string; confidence: number }>> = {};

    for (const coverage of coverages) {
      const mapping = await this.mapCoverage(coverage.name, coverage.insurerName, domain);

      if (mapping.groups.length > 0) {
        const bestGroup = mapping.groups[0];
        const node = this.getNodeById(bestGroup.groupId, domain);
        
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
  getTypicalDeductible(groupId: string, domain?: string): string | undefined {
    const node = this.getNodeById(groupId, domain);
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
        } as any, {
          onConflict: 'raw_name,insurer_name',
          ignoreDuplicates: false
        });

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
          } as any, {
            onConflict: 'raw_name,insurer_name',
            ignoreDuplicates: false
          });
        
        if (fallbackError) {
          // Silenciar error de duplicado - no es crítico
          if (fallbackError.code === '23505') {
            console.log(`🌳 [Ontology DB] Mapping already exists for "${mapping.rawName}"`);
            return;
          }
          throw fallbackError;
        }
      }
      console.log(`🌳 [Ontology DB] Saved mapping for "${mapping.rawName}"`);
    } catch (error: any) {
      // Silenciar error de duplicado - no es crítico
      if (error?.code === '23505') {
        console.log(`🌳 [Ontology DB] Mapping already exists for "${mapping.rawName}"`);
        return;
      }
      console.error('❌ [Ontology DB] Failed to save mapping:', error);
    }
  }
};

export default coverageOntology;

