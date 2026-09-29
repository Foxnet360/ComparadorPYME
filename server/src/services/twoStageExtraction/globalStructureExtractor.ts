import { Type } from '@google/genai';
import { getGenAI, UploadedFile } from '../gemini';
import { parseJsonWithRepair } from '../jsonRepair';
import {
  GlobalStructureExtraction,
  GlobalStructureSchema,
} from '../../types/twoStageExtraction';

const SchemaType = Type;

export const GlobalStructureJsonSchema = {
  description: 'Metadata, financial breakdown and coverage sections mapping of an insurance quote',
  type: SchemaType.OBJECT,
  properties: {
    insurerName: {
      type: SchemaType.STRING,
      description: 'Name of the insurance company (e.g. SURA, SEGUROS BOLIVAR, CHUBB, ALLIANZ, MAPFRE, AXA COLPATRIA, SBS)',
      nullable: false,
    },
    policyName: {
      type: SchemaType.STRING,
      description: 'Product or policy commercial name (e.g. MULTIRRIESGO PYME, EMPRESARIAL, TODO RIESGO DAÑO MATERIAL)',
      nullable: false,
    },
    validityPeriod: {
      type: SchemaType.STRING,
      description: 'Policy validity period if stated',
      nullable: true,
    },
    formatFamily: {
      type: SchemaType.STRING,
      description: 'Detected format layout family (e.g. TABLE-DOUBLE, SECTIONS, BULLET-LIST, HYBRID)',
      nullable: false,
    },
    premium: {
      type: SchemaType.OBJECT,
      description: 'Financial premium breakdown',
      properties: {
        netPremium: { type: SchemaType.NUMBER, description: 'Prima neta antes de gastos e impuestos' },
        fees: { type: SchemaType.NUMBER, description: 'Gastos de expedición' },
        taxes: { type: SchemaType.NUMBER, description: 'Impuestos / IVA (19% en Colombia)' },
        otherCharges: { type: SchemaType.NUMBER, description: 'Otros cargos o asistencias facturadas en póliza' },
        totalPayable: { type: SchemaType.NUMBER, description: 'Prima total a pagar con IVA y gastos incluidos' },
        currency: { type: SchemaType.STRING, description: 'Moneda (COP o USD)' },
        periodicity: { type: SchemaType.STRING, description: 'Periodicidad de pago (Anual, Semestral, Mensual, etc.)' },
      },
      required: ['totalPayable', 'currency'],
    },
    insuredAssets: {
      type: SchemaType.ARRAY,
      description: 'List of insured assets (e.g. EDIFICIOS, CONTENIDOS, MAQUINARIA)',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          assetType: { type: SchemaType.STRING, description: 'Tipo de bien asegurado' },
          value: { type: SchemaType.NUMBER, description: 'Valor asegurado declarado' },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ['assetType', 'value'],
      },
    },
    coverageSections: {
      type: SchemaType.ARRAY,
      description: 'Mapping of coverage sections, chapters or tables found across the document',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sectionName: { type: SchemaType.STRING, description: 'Nombre de la sección o capítulo (ej: AMPAROS BÁSICOS, TERREMOTO, R.C.)' },
          pageNumber: { type: SchemaType.NUMBER, description: 'Página donde inicia o se ubica esta sección (1-based)' },
          description: { type: SchemaType.STRING, description: 'Breve descripción del contenido' },
        },
        required: ['sectionName'],
      },
    },
    specialConditions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Condiciones especiales o cláusulas adicionales destacadas',
    },
    exclusions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Exclusiones generales destacadas en la carátula',
    },
    warranties: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Garantías de seguridad exigidas',
    },
  },
  required: ['insurerName', 'policyName', 'premium', 'formatFamily'],
};

export class GlobalStructureExtractor {
  public async extract(
    uploadedFile: UploadedFile,
    filename: string,
    extractedText?: string
  ): Promise<GlobalStructureExtraction> {
    const ai = getGenAI();
    const extractionModel = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

    let prompt = `Eres un extractor experto de seguros comerciales PYME en Colombia.
Tu objetivo en esta FASE 1 (Estructura Global) es analizar el documento completo y extraer únicamente:
1. Metadatos generales: Aseguradora, Nombre de la Póliza/Producto, Vigencia y Familia de Formato.
2. Desglose económico de prima: Prima neta, Gastos de expedición, IVA, Otros cargos y Total a pagar (en COP o USD).
3. Bienes asegurados (Edificios, Mercancías, Maquinaria, etc.) con sus valores.
4. Mapeo de Secciones de Cobertura: Identifica los nombres de los capítulos, tablas o secciones de amparos y en qué página(s) están ubicados.
5. Condiciones especiales, garantías o exclusiones mayores si están resumidas.

NO extraigas el listado individual y exhaustivo de cada cobertura en esta fase; eso se realizará en la Fase 2. Concéntrate en la precisión de las primas y el mapa general.`;

    if (extractedText && extractedText.trim().length > 0) {
      prompt += `\n\n=== TEXTO EXTRAÍDO NATIVAMENTE (REFERENCIA DE ALTA FIDELIDAD) ===\n`;
      prompt += `Utiliza el siguiente texto extraído del PDF como referencia para validar cifras de primas y nombres:\n\n`;
      prompt += `${extractedText.slice(0, 80000)}`;
    }

    console.log(`🧭 [TwoStage:Global] Extracting global structure for ${filename}...`);

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
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: GlobalStructureJsonSchema as unknown,
        thinkingConfig: {
          thinkingLevel: (process.env.GEMINI_THINKING_LEVEL || 'low') as any,
        },
      },
    });

    const responseText = result.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini in global structure extraction');
    }

    const parseResult = parseJsonWithRepair(responseText);
    if (!parseResult.success) {
      throw new Error(`JSON parsing failed in global structure: ${parseResult.error}`);
    }

    const validated = GlobalStructureSchema.parse(parseResult.data);
    console.log(
      `✅ [TwoStage:Global] Extracted metadata: Insurer="${validated.insurerName}", Policy="${validated.policyName}", Sections=${validated.coverageSections?.length || 0}`
    );

    return validated;
  }
}

export const globalStructureExtractor = new GlobalStructureExtractor();
