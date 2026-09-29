import { Type } from '@google/genai';
import { getGenAI, UploadedFile } from '../gemini';
import { parseJsonWithRepair } from '../jsonRepair';
import {
  CoverageSectionHint,
  FocalizedCoverageExtraction,
  FocalizedCoverageSchema,
} from '../../types/twoStageExtraction';

const SchemaType = Type;

export const FocalizedCoverageJsonSchema = {
  description: 'Detailed coverage items, sublimits and deductibles extracted from quote pages',
  type: SchemaType.OBJECT,
  properties: {
    rawCoverages: {
      type: SchemaType.ARRAY,
      description: 'Coverages as they appear in the document',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          section: {
            type: SchemaType.STRING,
            description: 'Section or chapter name (e.g., DAÑOS MATERIALES, R.C., TRANSPORTE)',
            nullable: true,
          },
          rawName: { type: SchemaType.STRING, description: 'Exact coverage name from document' },
          insuredAmount: { type: SchemaType.NUMBER, description: 'Insured amount / Limite asegurado', nullable: true },
          deductible: {
            type: SchemaType.STRING,
            description: 'Deductible text verbatim as it appears in document. If none, null.',
            nullable: true,
          },
          rawTextSnippet: {
            type: SchemaType.STRING,
            description: 'Exact contiguous text snippet (50-300 chars) from the document proving this coverage and its parameters.',
            nullable: false,
          },
          pageNumber: {
            type: SchemaType.NUMBER,
            description: '1-based PDF page number where rawTextSnippet appears.',
            nullable: false,
          },
          premium: {
            type: SchemaType.NUMBER,
            description: 'Individual premium if specified for this coverage',
            nullable: true,
          },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ['rawName', 'rawTextSnippet', 'pageNumber'],
      },
    },
    subLimits: {
      type: SchemaType.ARRAY,
      description: 'Sub-limits associated with main coverages',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          parentCoverage: { type: SchemaType.STRING, description: 'Parent coverage name' },
          name: { type: SchemaType.STRING, description: 'Sub-limit name' },
          limit: { type: SchemaType.NUMBER, description: 'Sub-limit amount' },
          deductible: { type: SchemaType.STRING, nullable: true },
        },
        required: ['parentCoverage', 'name', 'limit'],
      },
    },
    generalDeductibles: {
      type: SchemaType.ARRAY,
      description: 'General deductibles applicable across sections or whole policy',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          appliesTo: { type: SchemaType.STRING, description: 'Target section or coverage group' },
          deductibleText: { type: SchemaType.STRING, description: 'Deductible text' },
        },
        required: ['appliesTo', 'deductibleText'],
      },
    },
  },
  required: ['rawCoverages'],
};

export class FocalizedCoverageExtractor {
  public async extract(
    uploadedFile: UploadedFile,
    filename: string,
    coverageSections?: CoverageSectionHint[],
    extractedText?: string
  ): Promise<FocalizedCoverageExtraction> {
    const ai = getGenAI();
    const extractionModel = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

    let prompt = `Eres un extractor especialista en clausulado y tablas de coberturas para seguros comerciales PYME en Colombia.
Tu objetivo en esta FASE 2 (Extracción Focalizada de Coberturas) es extraer TODAS y cada una de las coberturas, amparos, sublímites y deducibles del documento con máxima precisión y anclaje posicional.

INSTRUCCIONES CLAVE:
1. Extrae cada cobertura con su 'rawName' exacto, 'insuredAmount' (si aplica), y 'deductible' específico.
2. ANCLAJE POSICIONAL ESTRICTO:
   - 'rawTextSnippet': Debes extraer una porción contigua de texto real (entre 50 y 300 caracteres) del documento donde figure la cobertura.
   - 'pageNumber': Número de página 1-based exacto donde se encuentra la cobertura.
3. Sublímites: Separa los sublímites con su 'parentCoverage' y 'limit'.
4. Deducibles generales: Si existen cláusulas o tablas generales de deducibles (ej. "10% del valor de la pérdida mínimo 3 SMMLV"), captúralas en generalDeductibles.`;

    if (coverageSections && coverageSections.length > 0) {
      prompt += `\n\n=== MAPA DE SECCIONES DETECTADAS EN FASE 1 ===\n`;
      prompt += `Utiliza este índice de secciones para orientar tu búsqueda y garantizar cobertura completa:\n`;
      for (const sec of coverageSections) {
        prompt += `- Sección: "${sec.sectionName}" (Página estimada: ${sec.pageNumber ?? 'N/A'})${sec.description ? `: ${sec.description}` : ''}\n`;
      }
    }

    if (extractedText && extractedText.trim().length > 0) {
      prompt += `\n\n=== TEXTO NATIVO DE REFERENCIA ===\n`;
      prompt += `${extractedText.slice(0, 100000)}`;
    }

    console.log(`🔎 [TwoStage:Coverages] Extracting focalized coverages for ${filename}...`);

    const result = await ai.models.generateContent({
      model: extractionModel,
      contents: [
        { text: prompt },
        {
          fileData: {
            fileUri: uploadedFile.uri,
            mimeType: 'application/pdf',
          },
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json',
        responseSchema: FocalizedCoverageJsonSchema as unknown,
        thinkingConfig: {
          thinkingLevel: (process.env.GEMINI_THINKING_LEVEL || 'low') as any,
        },
      },
    });

    const responseText = result.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini in focalized coverage extraction');
    }

    const parseResult = parseJsonWithRepair(responseText);
    if (!parseResult.success) {
      throw new Error(`JSON parsing failed in focalized coverage: ${parseResult.error}`);
    }

    const validated = FocalizedCoverageSchema.parse(parseResult.data);
    console.log(
      `✅ [TwoStage:Coverages] Extracted ${validated.rawCoverages.length} coverages, ${validated.subLimits?.length || 0} sublimits`
    );

    return validated;
  }
}

export const focalizedCoverageExtractor = new FocalizedCoverageExtractor();
