/**
 * Virtual Lawyer Service
 * Generates legal opinions using RAG with client profile context
 * Combines quote, clause, and client profile for personalized legal analysis
 */

import { geminiService } from './gemini';
import { ragRetrievalService } from './ragRetrievalService';
import { ClientProfile } from './contextualRiskAnalyzer';

export interface LegalOpinion {
  coverageName: string;
  riskScenario: string;
  clauseInterpretation: string;
  recommendation: string;
  negotiationPoints: NegotiationPoint[];
  citations: ClauseCitation[];
  confidence: number;
}

export interface NegotiationPoint {
  point: string;
  rationale: string;
  expectedOutcome: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ClauseCitation {
  text: string;
  section: string;
  pageNumber: number;
  documentName: string;
}

interface QuoteData {
  insurerName: string;
  coverageName: string;
  value: string;
  deductible: string;
  exclusions: string[];
}

export const virtualLawyerService = {
  /**
   * Generate legal opinion for a coverage
   */
  generateLegalOpinion: async (
    quote: QuoteData,
    clientProfile: ClientProfile,
    insurerName: string
  ): Promise<LegalOpinion> => {
    console.log(`⚖️ [virtualLawyer] Generating legal opinion for ${quote.coverageName}...`);
    
    // Retrieve relevant clause chunks
    const clauseChunks = await retrieveRelevantClauses(quote.coverageName, insurerName);
    
    // Build enriched prompt
    const prompt = buildLegalPrompt(quote, clientProfile, clauseChunks);
    
    try {
      // Generate opinion with Gemini
      const response = await geminiService.extractText(prompt, '');
      
      // Parse response
      const opinion = parseLegalOpinion(response, quote.coverageName, clauseChunks);
      
      console.log(`✅ [virtualLawyer] Opinion generated with ${opinion.confidence}% confidence`);
      return opinion;
    } catch (error) {
      console.error('❌ [virtualLawyer] Error generating opinion:', error);
      return generateFallbackOpinion(quote, clauseChunks);
    }
  },
  
  /**
   * Generate opinions for multiple coverages
   */
  generateOpinions: async (
    quotes: QuoteData[],
    clientProfile: ClientProfile,
    insurerName: string
  ): Promise<LegalOpinion[]> => {
    const opinions: LegalOpinion[] = [];
    
    for (const quote of quotes) {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        quote,
        clientProfile,
        insurerName
      );
      opinions.push(opinion);
    }
    
    return opinions;
  },
  
  /**
   * Identify negotiation points
   */
  identifyNegotiationPoints: (
    opinions: LegalOpinion[]
  ): NegotiationPoint[] => {
    const allPoints = opinions.flatMap(o => o.negotiationPoints);
    
    // Sort by priority
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return allPoints.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }
};

async function retrieveRelevantClauses(
  coverageName: string,
  insurerName: string
): Promise<Array<{text: string; section: string; pageNumber: number}>> {
  try {
    const clauses = await ragRetrievalService.search(coverageName, {
      insurerName,
      coverageTags: [coverageName.toLowerCase()],
      limit: 3
    });
    
    return clauses.map(c => ({
      text: c.content,
      section: c.sectionType,
      pageNumber: c.pageNumber
    }));
  } catch (error) {
    console.warn('⚠️ Error retrieving clauses:', error);
    return [];
  }
}

function buildLegalPrompt(
  quote: QuoteData,
  profile: ClientProfile,
  clauses: Array<{text: string; section: string; pageNumber: number}>
): string {
  const clauseText = clauses.map(c => 
    `[${c.section} - Pág. ${c.pageNumber}]: ${c.text}`
  ).join('\n\n');

  return `Eres un abogado especialista en seguros colombianos. Analiza la siguiente situación y genera una opinión legal estructurada.

CLIENTE:
- Industria: ${profile.industryType}
- Ubicación: ${profile.locationCity} (${profile.locationZone})
- Empleados: ${profile.employeeCount}
- Edificio: ${profile.buildingType}
- Actividad: ${profile.primaryActivity}
${profile.hasSingleSupplier ? '- Dependencia: Único proveedor clave' : ''}

COTIZACIÓN:
- Aseguradora: ${quote.insurerName}
- Cobertura: ${quote.coverageName}
- Valor: ${quote.value}
- Deducible: ${quote.deductible}

CLAUSULADO RELEVANTE:
${clauseText || 'No se encontraron cláusulas específicas.'}

INSTRUCCIONES:
1. Evalúa si esta cobertura es adecuada para el cliente considerando su perfil
2. Identifica riesgos específicos no cubiertos
3. Sugiere puntos de negociación
4. Cita artículos específicos del clausulado

FORMATO DE RESPUESTA:
=== ESCENARIO DE RIESGO ===
[Describe el riesgo principal]

=== INTERPRETACIÓN DEL CLAUSULADO ===
[Interpreta las cláusulas relevantes]

=== RECOMENDACIÓN ===
[Recomendación principal]

=== PUNTOS DE NEGOCIACIÓN ===
1. [punto] - [justificación] - [resultado esperado] - [prioridad: ALTA/MEDIA/BAJA]
2. [punto] - [justificación] - [resultado esperado] - [prioridad]

=== CONFIANZA ===
[porcentaje 0-100]`;
}

function parseLegalOpinion(
  response: string,
  coverageName: string,
  clauses: Array<{text: string; section: string; pageNumber: number}>
): LegalOpinion {
  // Extract sections
  const riskMatch = response.match(/=== ESCENARIO DE RIESGO ===\n?([\s\S]*?)(?=\n=== INTERPRETACIÓN|$)/);
  const interpretationMatch = response.match(/=== INTERPRETACIÓN DEL CLAUSULADO ===\n?([\s\S]*?)(?=\n=== RECOMENDACIÓN|$)/);
  const recommendationMatch = response.match(/=== RECOMENDACIÓN ===\n?([\s\S]*?)(?=\n=== PUNTOS DE NEGOCIACIÓN|$)/);
  const pointsMatch = response.match(/=== PUNTOS DE NEGOCIACIÓN ===\n?([\s\S]*?)(?=\n=== CONFIANZA|$)/);
  const confidenceMatch = response.match(/=== CONFIANZA ===\n?(\d+)/);
  
  // Parse negotiation points
  const negotiationPoints: NegotiationPoint[] = [];
  if (pointsMatch) {
    const lines = pointsMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
    
    for (const line of lines) {
      const parts = line.replace(/^[-\d.\s]+/, '').split(' - ');
      if (parts.length >= 2) {
        negotiationPoints.push({
          point: parts[0].trim(),
          rationale: parts[1]?.trim() || '',
          expectedOutcome: parts[2]?.trim() || 'Por definir',
          priority: (parts[3]?.trim().toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM'
        });
      }
    }
  }
  
  // Build citations
  const citations: ClauseCitation[] = clauses.map(c => ({
    text: c.text.substring(0, 200) + (c.text.length > 200 ? '...' : ''),
    section: c.section,
    pageNumber: c.pageNumber,
    documentName: 'Clausulado'
  }));
  
  return {
    coverageName,
    riskScenario: riskMatch?.[1]?.trim() || 'Riesgo no especificado',
    clauseInterpretation: interpretationMatch?.[1]?.trim() || 'Sin interpretación',
    recommendation: recommendationMatch?.[1]?.trim() || 'Sin recomendación',
    negotiationPoints: negotiationPoints.length > 0 ? negotiationPoints : [{
      point: 'Verificar cobertura con corredor',
      rationale: 'Análisis preliminar',
      expectedOutcome: 'Aclaración de términos',
      priority: 'MEDIUM'
    }],
    citations,
    confidence: parseInt(confidenceMatch?.[1] || '70')
  };
}

function generateFallbackOpinion(
  quote: QuoteData,
  clauses: Array<{text: string; section: string; pageNumber: number}>
): LegalOpinion {
  return {
    coverageName: quote.coverageName,
    riskScenario: `Análisis de ${quote.coverageName} para ${quote.insurerName}`,
    clauseInterpretation: 'Se requiere revisión manual del clausulado para una interpretación precisa.',
    recommendation: 'Consultar con el corredor de seguros para verificar los términos específicos de esta cobertura.',
    negotiationPoints: [{
      point: 'Solicitar copia del clausulado completo',
      rationale: 'Para verificación detallada',
      expectedOutcome: 'Mayor claridad contractual',
      priority: 'HIGH'
    }],
    citations: clauses.map(c => ({
      text: c.text.substring(0, 200),
      section: c.section,
      pageNumber: c.pageNumber,
      documentName: 'Clausulado'
    })),
    confidence: 50
  };
}

export default virtualLawyerService;
