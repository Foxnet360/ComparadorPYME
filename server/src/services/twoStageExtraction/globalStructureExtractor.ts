import { Type } from '@google/genai';
import { env } from '../../config/env';
import { getGenAI, UploadedFile, extractHighSignalReferenceText } from '../gemini';
import { parseJsonWithRepair } from '../jsonRepair';
import { GlobalStructureExtraction, GlobalStructureSchema } from '../../types/twoStageExtraction';

const SchemaType = Type;

export const GlobalStructureJsonSchema = {
  description: 'Metadata, financial breakdown and coverage sections mapping of an insurance quote',
  type: SchemaType.OBJECT,
  properties: {
    insurerName: {
      type: SchemaType.STRING,
      description:
        'Name of the insurance company (e.g. SURA, SEGUROS BOLIVAR, CHUBB, ALLIANZ, MAPFRE, AXA COLPATRIA, SBS)',
      nullable: false,
    },
    policyName: {
      type: SchemaType.STRING,
      description:
        'Product or policy commercial name (e.g. MULTIRRIESGO PYME, EMPRESARIAL, TODO RIESGO DAÑO MATERIAL)',
      nullable: false,
    },
    validityPeriod: {
      type: SchemaType.STRING,
      description: 'Policy validity period if stated',
      nullable: true,
    },
    formatFamily: {
      type: SchemaType.STRING,
      description:
        'Detected format layout family (e.g. TABLE-DOUBLE, SECTIONS, BULLET-LIST, HYBRID)',
      nullable: false,
    },
    premium: {
      type: SchemaType.OBJECT,
      description: 'Financial premium breakdown',
      properties: {
        netPremium: {
          type: SchemaType.NUMBER,
          description: 'Prima neta antes de gastos e impuestos',
        },
        fees: { type: SchemaType.NUMBER, description: 'Gastos de expedición' },
        taxes: { type: SchemaType.NUMBER, description: 'Impuestos / IVA (19% en Colombia)' },
        otherCharges: {
          type: SchemaType.NUMBER,
          description: 'Otros cargos o asistencias facturadas en póliza',
        },
        totalPayable: {
          type: SchemaType.NUMBER,
          description: 'Prima total a pagar con IVA y gastos incluidos',
        },
        currency: { type: SchemaType.STRING, description: 'Moneda (COP o USD)' },
        periodicity: {
          type: SchemaType.STRING,
          description: 'Periodicidad de pago (Anual, Semestral, Mensual, etc.)',
        },
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
          sectionName: {
            type: SchemaType.STRING,
            description: 'Nombre de la sección o capítulo (ej: AMPAROS BÁSICOS, TERREMOTO, R.C.)',
          },
          pageNumber: {
            type: SchemaType.NUMBER,
            description: 'Página donde inicia o se ubica esta sección (1-based)',
          },
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
    collectiveDetails: {
      type: SchemaType.OBJECT,
      description:
        'Datos técnicos de póliza colectiva o flota (aplicable en Autos Flotas/Colectivos, Salud Colectiva y Vida Grupo)',
      nullable: true,
      properties: {
        isCollective: {
          type: SchemaType.BOOLEAN,
          description: 'True si la cotización corresponde a una póliza colectiva, flota o grupo',
        },
        modality: {
          type: SchemaType.STRING,
          description:
            'INDIVIDUAL | FLOTA_EMPRESARIAL | COLECTIVA_EMPLEADOS | SALUD_COLECTIVA | VIDA_GRUPO',
          nullable: true,
        },
        insuredCount: {
          type: SchemaType.NUMBER,
          description: 'Número total de vidas aseguradas o vehículos en la flota',
          nullable: true,
        },
        totalInsuredCumulus: {
          type: SchemaType.NUMBER,
          description: 'Cúmulo total asegurado del grupo o valor comercial total de la flota (COP)',
          nullable: true,
        },
        ratePerMil: {
          type: SchemaType.STRING,
          description: 'Tasa por mil (‰) o tasa media aplicada al colectivo/flota',
          nullable: true,
        },
        freeCoverLimit: {
          type: SchemaType.NUMBER,
          description: 'Free Cover Limit: capital máximo sin exámenes médicos (COP)',
          nullable: true,
        },
        entryAgeLimit: {
          type: SchemaType.STRING,
          description: 'Edad mínima/máxima de ingreso al colectivo',
          nullable: true,
        },
        permanenceAgeLimit: {
          type: SchemaType.STRING,
          description: 'Edad máxima de permanencia en el colectivo',
          nullable: true,
        },
        continuityAndPreexisting: {
          type: SchemaType.STRING,
          description: 'Condiciones de continuidad de antigüedad, preexistencias y carencias',
          nullable: true,
        },
        profitSharing: {
          type: SchemaType.STRING,
          description: 'Cláusula de participación de utilidades o bonificación por siniestralidad',
          nullable: true,
        },
        categoryBreakdownSummary: {
          type: SchemaType.STRING,
          description:
            'Resumen de tarifas/condiciones por categoría vehicular, sub-plan o franja etaria',
          nullable: true,
        },
      },
    },
    cumplimientoDetails: {
      type: SchemaType.OBJECT,
      description:
        'Ficha técnica de Cumplimiento y Fianzas (Etapa Licitación vs Contrato vs Otrosí, Régimen Ley 80/Particular, Contragarantías y RCE Derivada)',
      nullable: true,
      properties: {
        contractStage: {
          type: SchemaType.STRING,
          description:
            'PRECONTRACTUAL_LICITACION (Seriedad de Oferta) | CONTRACTUAL_EJECUCION (Garantía Única de Contrato) | MODIFICACION_OTROSI',
          nullable: true,
        },
        legalRegime: {
          type: SchemaType.STRING,
          description:
            'ESTATAL_LEY_80 (Decreto 1082/2015) | PARTICULAR | REGIMEN_ESPECIAL (Ecopetrol, ESP, Grandes Beneficiarios)',
          nullable: true,
        },
        processOrContractNumber: {
          type: SchemaType.STRING,
          description: 'Número de Proceso SECOP II / Licitación o Número de Contrato',
          nullable: true,
        },
        afianzadoName: {
          type: SchemaType.STRING,
          description:
            'Nombre y NIT del Tomador / Contratista / Proponente (incluyendo Consorcio o Unión Temporal y % participación)',
          nullable: true,
        },
        beneficiaryName: {
          type: SchemaType.STRING,
          description: 'Nombre y NIT de la Entidad Estatal o Contratante Beneficiario',
          nullable: true,
        },
        contractOrBudgetValue: {
          type: SchemaType.NUMBER,
          description: 'Valor total del Contrato o Presupuesto Oficial de la Licitación en COP',
          nullable: true,
        },
        contractDuration: {
          type: SchemaType.STRING,
          description: 'Plazo de ejecución del contrato o vigencia base de la licitación',
          nullable: true,
        },
        counterGuarantee: {
          type: SchemaType.STRING,
          description:
            'Contragarantía exigida (Pagaré en blanco, Codeudor, Colateral/Prenda, Cupo de Cumplimiento aprobado)',
          nullable: true,
        },
        appliedRateSummary: {
          type: SchemaType.STRING,
          description: 'Resumen de tasas aplicadas por amparo (% o ‰) o prima mínima',
          nullable: true,
        },
        rceDerivativeSummary: {
          type: SchemaType.STRING,
          description:
            'Condiciones de RCE Derivada (Suma en COP/SMMLV, modalidad Ocurrencia, amparos Patronal/Cruzada/Lucro Cesante y deducible)',
          nullable: true,
        },
      },
    },
  },
  required: ['insurerName', 'policyName', 'premium', 'formatFamily'],
};

export function getDomainDescription(domain?: string): string {
  switch (domain?.toLowerCase()) {
    case 'autos':
      return 'seguros de automóviles y vehículos en Colombia';
    case 'copropiedades':
      return 'seguros de copropiedades y zonas comunes (Ley 675) en Colombia';
    case 'salud':
      return 'seguros de salud y planes de medicina prepagada en Colombia';
    case 'vida_grupo':
      return 'seguros de vida grupo y vida colectivo en Colombia';
    case 'cumplimiento':
      return 'seguros de cumplimiento y fianzas en Colombia';
    case 'transporte':
      return 'seguros de transporte de mercancías y carga en Colombia';
    case 'hogar':
      return 'seguros de hogar y vivienda en Colombia';
    case 'equipo_maquinaria':
      return 'seguros de equipo y maquinaria en Colombia';
    case 'casco_embarcacion':
      return 'seguros de casco y embarcaciones en Colombia';
    case 'pyme':
    default:
      return 'seguros comerciales y empresariales en Colombia';
  }
}

export class GlobalStructureExtractor {
  public async extract(
    uploadedFile: UploadedFile,
    filename: string,
    extractedText?: string,
    domain?: string,
    cachedContent?: string | null
  ): Promise<GlobalStructureExtraction> {
    const ai = getGenAI();
    const extractionModel = env.GEMINI_MODEL;

    const domainDesc = getDomainDescription(domain);
    let prompt = `Eres un extractor experto de ${domainDesc}.
Tu objetivo en esta FASE 1 (Estructura Global) es analizar el documento completo y extraer únicamente:
1. Metadatos generales: Aseguradora, Nombre de la Póliza/Producto, Vigencia y Familia de Formato.
2. Desglose económico de prima: Prima neta, Gastos de expedición, IVA, Otros cargos y Total a pagar (en COP o USD).
3. Bienes asegurados (Edificios, Mercancías, Maquinaria, etc.) con sus valores.
4. Mapeo de Secciones de Cobertura: Identifica los nombres de los capítulos, tablas o secciones de amparos y en qué página(s) están ubicados.
5. Condiciones especiales, garantías o exclusiones mayores si están resumidas.
6. Ficha Técnica de Colectivo / Flota (collectiveDetails): Si el documento es una póliza colectiva, flota de vehículos, salud colectiva o vida grupo, extrae isCollective=true, modality, insuredCount (N° de vidas o vehículos), totalInsuredCumulus (cúmulo asegurado), ratePerMil (tasa por mil o tasa media), freeCoverLimit (tope sin requisitos médicos en COP), entryAgeLimit, permanenceAgeLimit, continuityAndPreexisting, profitSharing y categoryBreakdownSummary.
7. Ficha Técnica de Cumplimiento y Fianzas (cumplimientoDetails): Si el documento es de Cumplimiento/Fianzas, identifica la etapa (PRECONTRACTUAL_LICITACION si es Seriedad de Oferta para pliego; CONTRACTUAL_EJECUCION si es Garantía Única de Contrato; MODIFICACION_OTROSI si es prórroga/adición), legalRegime (ESTATAL_LEY_80, PARTICULAR o REGIMEN_ESPECIAL), processOrContractNumber, afianzadoName (incluyendo Consorcio/UT), beneficiaryName, contractOrBudgetValue, contractDuration, counterGuarantee (Pagaré, Cupo, Colateral), appliedRateSummary y rceDerivativeSummary.

NO extraigas el listado individual y exhaustivo de cada cobertura en esta fase; eso se realizará en la Fase 2. Concéntrate en la precisión de las primas y el mapa general.`;

    if (extractedText && extractedText.trim().length > 0) {
      const highSignalText =
        typeof extractHighSignalReferenceText === 'function'
          ? extractHighSignalReferenceText(extractedText, 35000)
          : extractedText.slice(0, 35000);
      prompt += `\n\n=== TEXTO EXTRAÍDO NATIVAMENTE (REFERENCIA DE ALTA FIDELIDAD) ===\n`;
      prompt += `Utiliza el siguiente texto extraído del PDF como referencia para validar cifras de primas y nombres:\n\n`;
      prompt += `${highSignalText}`;
    }

    console.log(`🧭 [TwoStage:Global] Extracting global structure for ${filename}...`);

    const activeCache = cachedContent ?? uploadedFile.cachedContent ?? null;
    const contents = activeCache
      ? [{ text: prompt }]
      : [
          { text: prompt },
          {
            fileData: {
              fileUri: uploadedFile.uri,
              mimeType: 'application/pdf',
            },
          },
        ];

    const config: Record<string, unknown> = {
      temperature: 0.1,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: GlobalStructureJsonSchema as unknown,
      thinkingConfig: {
        thinkingLevel: 'low' as any,
      },
    };
    if (activeCache) {
      config.cachedContent = activeCache;
    }

    const result = await ai.models.generateContent({
      model: extractionModel,
      contents,
      config,
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
