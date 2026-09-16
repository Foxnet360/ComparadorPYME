/**
 * Deep Clause Validator
 * Validates comparison results against clause PDFs
 * Resolves ambiguous deductibles and detects discrepancies
 */

import { UnifiedComparisonResult, DeepModeResult } from '../../types/unifiedComparison';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface GeminiFile {
  name?: string;
  displayName?: string;
  uri?: string;
  state?: string;
}

interface ValidationEntry {
  insurer: string;
  coverage: string;
  field: string;
  originalValue?: string;
  validatedValue: string;
  source: string;
  confidence?: number;
}

interface DiscrepancyEntry {
  insurer: string;
  type: 'deductible' | 'coverage' | 'exclusion';
  description: string;
  severity: 'high' | 'medium' | 'low';
}

interface DeepValidationResponse {
  validations?: ValidationEntry[];
  discrepancies?: DiscrepancyEntry[];
  warnings?: string[];
}

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  return new GoogleGenAI({ apiKey });
};

export class DeepClauseValidator {
  /**
   * Validate comparison results against clause PDFs
   */
  async validateWithClauses(
    comparison: UnifiedComparisonResult,
    clausePaths: string[]
  ): Promise<DeepModeResult> {
    const correlationId = `deep-validation-${Date.now()}`;

    console.log(
      `🔍 [DeepClauseValidator] Starting validation with ${clausePaths.length} clauses [${correlationId}]`
    );

    try {
      // Upload clause PDFs
      const uploadedClauses = await this.uploadClauses(clausePaths);

      // Build validation prompt
      const prompt = this.buildValidationPrompt(comparison);

      // Call Gemini for validation
      const validationResult = await this.callGeminiForValidation(
        uploadedClauses,
        prompt,
        correlationId
      );

      // Parse and apply validations
      const validatedComparison = this.applyValidations(comparison, validationResult);

      // Build deep mode result
      const deepResult: DeepModeResult = {
        originalComparison: comparison,
        validatedComparison,
        validations: (validationResult.validations || []).map((v) => ({
          insurer: v.insurer,
          coverage: v.coverage,
          field: v.field,
          originalValue: v.originalValue || '',
          validatedValue: v.validatedValue,
          source: v.source,
          confidence: v.confidence ?? 0,
        })),
        discrepancies: (validationResult.discrepancies || []).map((d) => ({
          insurer: d.insurer,
          type: d.type,
          description: d.description,
          severity: d.severity,
        })),
      };

      console.log(`✅ [DeepClauseValidator] Validation complete [${correlationId}]`);
      console.log(
        `📊 [DeepClauseValidator] Found ${deepResult.validations.length} validations, ${deepResult.discrepancies.length} discrepancies [${correlationId}]`
      );

      return deepResult;
    } catch (error) {
      console.error(
        `❌ [DeepClauseValidator] Validation failed [${correlationId}]:`,
        error instanceof Error ? error.message : String(error)
      );
      throw new Error(
        `Clause validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Upload clause PDFs to Gemini
   */
  private async uploadClauses(filePaths: string[]): Promise<GeminiFile[]> {
    const ai = getGenAI();
    const uploadedFiles = [];

    for (const filePath of filePaths) {
      try {
        const uploadedFile = await ai.files.upload({
          file: filePath,
          config: {
            mimeType: 'application/pdf',
            displayName: `clause-${filePath.split('/').pop()}`,
          },
        });

        // Wait for processing
        const fileName = uploadedFile.name || '';
        let file = await ai.files.get({ name: fileName });
        while (file.state === 'PROCESSING') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await ai.files.get({ name: fileName });
        }

        if (file.state !== 'ACTIVE') {
          throw new Error(`Clause file ${fileName} failed to process`);
        }

        uploadedFiles.push(file);
      } catch (error) {
        console.error(
          `❌ [DeepClauseValidator] Failed to upload clause ${filePath}:`,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }

    return uploadedFiles;
  }

  /**
   * Build validation prompt
   */
  private buildValidationPrompt(comparison: UnifiedComparisonResult): string {
    return `Eres un analista experto en clausulados de seguros colombianos. 

COMPARACIÓN A VALIDAR:
${JSON.stringify(comparison, null, 2)}

CLAUSULADOS ADJUNTOS:
Los clausulados de las aseguradoras están adjuntos como documentos PDF.

TAREA:
1. Para cada deducible marcado como "Ver condiciones", busca el valor exacto en el clausulado
2. Verifica que las coberturas listadas como "Incluidas" realmente lo estén según el clausulado
3. Identifica exclusiones mencionadas en el clausulado pero no en la cotización
4. Detecta discrepancias entre lo que dice la cotización y el clausulado
5. Extrae sub-límites específicos del clausulado

FORMATO DE RESPUESTA (JSON):
{
  "validations": [
    {
      "insurer": "nombre aseguradora",
      "coverage": "nombre cobertura",
      "field": "campo validado (deductible/coverage/value)",
      "originalValue": "valor original",
      "validatedValue": "valor validado",
      "source": "página del clausulado",
      "confidence": 0.95
    }
  ],
  "discrepancies": [
    {
      "insurer": "nombre aseguradora",
      "type": "deductible|coverage|exclusion",
      "description": "descripción de la discrepancia",
      "severity": "high|medium|low"
    }
  ]
}

Responde ÚNICAMENTE con el JSON. No incluyas explicaciones.`;
  }

  /**
   * Call Gemini for validation
   */
  private async callGeminiForValidation(
    clauses: GeminiFile[],
    prompt: string,
    correlationId: string
  ): Promise<DeepValidationResponse> {
    const ai = getGenAI();

    const contents = [
      ...clauses.map((clause) => ({
        fileData: {
          fileUri: clause.uri,
          mimeType: 'application/pdf',
        },
      })),
      { text: prompt },
    ];

    console.log(`🤖 [DeepClauseValidator] Calling Gemini for validation [${correlationId}]`);

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_CLAUSE_MODEL || process.env.GEMINI_MODEL || 'gemini-3.7-flash',
      contents,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH, // Use high for complex validation
        },
        responseMimeType: 'application/json',
      },
    });

    if (!result.text) {
      throw new Error('Empty response from Gemini during validation');
    }

    console.log(`✅ [DeepClauseValidator] Validation response received [${correlationId}]`);

    try {
      return JSON.parse(result.text) as DeepValidationResponse;
    } catch (error) {
      console.error(
        `❌ [DeepClauseValidator] Failed to parse validation response [${correlationId}]:`,
        error instanceof Error ? error.message : String(error)
      );
      throw new Error('Invalid validation response format');
    }
  }

  /**
   * Apply validations to comparison result
   */
  private applyValidations(
    comparison: UnifiedComparisonResult,
    validationResult: DeepValidationResponse
  ): UnifiedComparisonResult {
    const validated = JSON.parse(JSON.stringify(comparison)) as UnifiedComparisonResult; // Deep clone

    // Apply deductible validations
    if (validationResult.validations) {
      validationResult.validations.forEach((validation) => {
        this.applySingleValidation(validated, validation);
      });
    }

    // Add discrepancy warnings
    if (validationResult.discrepancies) {
      validationResult.discrepancies.forEach((discrepancy) => {
        validated.analysis.warnings.push(
          `[${discrepancy.severity.toUpperCase()}] ${discrepancy.insurer}: ${discrepancy.description}`
        );

        validated.analysis.significantDifferences.push({
          coverage: discrepancy.type,
          difference: discrepancy.description,
          severity: discrepancy.severity,
        });
      });
    }

    // Update metadata
    validated.metadata.confidence = Math.min(1, validated.metadata.confidence + 0.1);
    validated.metadata.needsHumanReview = validated.analysis.significantDifferences.length > 0;

    return validated;
  }

  /**
   * Apply a single validation to the comparison
   */
  private applySingleValidation(
    comparison: UnifiedComparisonResult,
    validation: ValidationEntry
  ): void {
    // Find the insurer index
    const insurerIndex = comparison.insurers.findIndex(
      (i) => i.name.toLowerCase() === validation.insurer.toLowerCase()
    );

    if (insurerIndex === -1) {
      console.warn(`⚠️ [DeepClauseValidator] Insurer not found: ${validation.insurer}`);
      return;
    }

    // Find the coverage section
    const section = comparison.coverageMatrix.find(
      (s) =>
        s.category.toLowerCase().includes(validation.coverage.toLowerCase()) ||
        s.category.toLowerCase().includes(validation.coverage.toLowerCase().replace(/\s+/g, ''))
    );

    if (!section) {
      console.warn(`⚠️ [DeepClauseValidator] Coverage section not found: ${validation.coverage}`);
      return;
    }

    // Find the specific row and update
    section.rows.forEach((row) => {
      if (
        row.type === validation.field ||
        (validation.field === 'deductible' && row.type === 'deductible')
      ) {
        if (row.cells[insurerIndex]) {
          row.cells[insurerIndex].value = validation.validatedValue;
          row.cells[insurerIndex].notes = `Validado contra clausulado (pág. ${validation.source})`;
          row.cells[insurerIndex].isAmbiguous = false;
        }
      }
    });
  }
}

export const deepClauseValidator = new DeepClauseValidator();
export default deepClauseValidator;
