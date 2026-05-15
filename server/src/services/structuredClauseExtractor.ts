import { GoogleGenAI } from '@google/genai';
import { supabase } from '../config/database';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface ExtractedCoverage {
  name: string;
  description: string;
  insuredAmount?: string;
  deductible?: {
    components: Array<{
      type: string;
      value: number;
      currency?: string;
    }>;
    rawText: string;
  };
  sublimit?: string;
  exclusions: string[];
  conditions: string[];
  sourcePage: number;
}

export interface StructuredClause {
  insurer: string;
  product: string;
  documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR';
  coverages: ExtractedCoverage[];
  generalExclusions: string[];
  generalConditions: string[];
  definitions: Record<string, string>;
}

const CLAUSE_EXTRACTION_PROMPT = `Analiza el siguiente clausulado de seguro y extrae la información estructurada.

REGLAS IMPORTANTES:
1. Extrae TODAS las coberturas mencionadas
2. Para cada cobertura, extrae: nombre, descripción, deducible, sublímite, exclusiones, condiciones
3. Los deducibles pueden ser simples ("10%") o compuestos ("10% con mínimo de 5 SMMLV y tope de 50 SMMLV")
4. Extrae exclusiones generales del documento
5. Extrae condiciones generales del documento
6. Extrae definiciones importantes
7. Indica el número de página donde aparece cada cobertura

FORMATO DE RESPUESTA (JSON válido):
{
  "coverages": [
    {
      "name": "Nombre exacto de la cobertura",
      "description": "Descripción detallada",
      "insuredAmount": "Valor asegurado si está especificado",
      "deductible": {
        "components": [
          {"type": "percentage", "value": 10},
          {"type": "minimum", "value": 5, "currency": "SMMLV"},
          {"type": "maximum", "value": 50, "currency": "SMMLV"}
        ],
        "rawText": "Texto original del deducible"
      },
      "sublimit": "Sublímite si aplica",
      "exclusions": ["Exclusión 1", "Exclusión 2"],
      "conditions": ["Condición 1", "Condición 2"],
      "sourcePage": 5
    }
  ],
  "generalExclusions": ["Exclusión general 1"],
  "generalConditions": ["Condición general 1"],
  "definitions": {
    "SMMLV": "Salario Mínimo Mensual Legal Vigente"
  }
}

CLAUSULADO:`;

export const structuredClauseExtractor = {
  /**
   * Extract structured data from clause text using LLM
   */
  async extractFromText(
    clauseText: string,
    insurerName: string,
    productName: string = '',
    documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' = 'CLAUSULADO_GENERAL'
  ): Promise<StructuredClause> {
    console.log(`📄 [StructuredExtractor] Extracting clauses for ${insurerName}...`);
    
    try {
      const prompt = `${CLAUSE_EXTRACTION_PROMPT}\n\n${clauseText}`;
      
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      
      const responseText = result.text || '{}';
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const extracted = JSON.parse(jsonMatch[0]);
      
      const structured: StructuredClause = {
        insurer: insurerName,
        product: productName,
        documentType,
        coverages: extracted.coverages || [],
        generalExclusions: extracted.generalExclusions || [],
        generalConditions: extracted.generalConditions || [],
        definitions: extracted.definitions || {}
      };
      
      console.log(`✅ [StructuredExtractor] Extracted ${structured.coverages.length} coverages`);
      return structured;
      
    } catch (error) {
      console.error('❌ [StructuredExtractor] Extraction failed:', error);
      throw error;
    }
  },

  /**
   * Store structured clause in database
   */
  async storeStructuredClause(
    structured: StructuredClause,
    documentId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('structured_clauses')
        .insert({
          insurer_name: structured.insurer,
          product_name: structured.product,
          document_type: structured.documentType,
          extracted_data: structured,
          document_id: documentId
        } as any)
        .select('id')
        .single();
      
      if (error) throw error;
      
      const resultId = (data as any)?.id;
      console.log(`✅ [StructuredExtractor] Stored clause with ID: ${resultId}`);
      return resultId;
      
    } catch (error) {
      console.error('❌ [StructuredExtractor] Storage failed:', error);
      throw error;
    }
  },

  /**
   * Search for structured clause by insurer and coverage
   */
  async searchClause(
    insurerName: string,
    coverageName?: string
  ): Promise<StructuredClause | null> {
    try {
      const { data, error } = await supabase
        .rpc('search_structured_clauses', {
          p_insurer_name: insurerName,
          p_coverage_name: coverageName,
          match_count: 1
        } as any);
      
      if (error) throw error;
      const dataList = (data || []) as any[];
      if (dataList.length === 0) return null;
      
      return dataList[0].extracted_data as StructuredClause;
      
    } catch (error) {
      console.error('❌ [StructuredExtractor] Search failed:', error);
      return null;
    }
  },

  /**
   * Get deductible for specific coverage
   */
  async getDeductible(
    insurerName: string,
    coverageName: string
  ): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_clause_deductible', {
          p_insurer_name: insurerName,
          p_coverage_name: coverageName
        } as any);
      
      if (error) throw error;
      const dataList = (data || []) as any[];
      if (dataList.length === 0) return null;
      
      return data[0];
      
    } catch (error) {
      console.error('❌ [StructuredExtractor] Get deductible failed:', error);
      return null;
    }
  },

  /**
   * Validate extracted data against raw text
   */
  validateExtraction(structured: StructuredClause, rawText: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check if coverage names appear in raw text
    for (const coverage of structured.coverages) {
      if (!rawText.toLowerCase().includes(coverage.name.toLowerCase())) {
        issues.push(`Coverage "${coverage.name}" not found in raw text`);
      }
    }
    
    // Check if deductibles are reasonable
    for (const coverage of structured.coverages) {
      if (coverage.deductible) {
        const hasPercentage = coverage.deductible.components.some(c => c.type === 'percentage');
        if (!hasPercentage && coverage.deductible.components.length > 0) {
          issues.push(`Coverage "${coverage.name}" has unusual deductible structure`);
        }
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
};

export default structuredClauseExtractor;
