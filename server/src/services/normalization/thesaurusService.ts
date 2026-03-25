import fs from 'fs';
import path from 'path';

// Cargar tesauro al iniciar
const thesaurusPath = path.join(__dirname, '../data/thesaurus.json');
let thesaurusCache: ThesaurusData | null = null;

export interface ThesaurusData {
  version: string;
  last_updated: string;
  metadata: {
    region: string;
    currency: string;
    salary_reference: string;
    salary_value_2024: number;
    uvt_value_2024: number;
  };
  coberturas_plantilla: Record<string, CoberturaDefinition>;
  deducibles: DeducibleConfig;
  terminos_legales: Record<string, LegalTerm>;
  alertas_auditores: {
    criticas: AlertaDefinicion[];
    atencion: AlertaDefinicion[];
    destacadas: AlertaDefinicion[];
  };
}

export interface CoberturaDefinition {
  id: string;
  sinonimos: string[];
  terminos_busqueda: string[];
  exclusiones_comunes?: string[];
  alertas_criticas?: string[];
  deducibles_tipicos?: {
    porcentaje: number[];
    minimo_smmlv: number[];
  };
  tipos?: Record<string, string[]>;
  nota_tecnica?: string;
}

export interface DeducibleConfig {
  formatos: Record<string, DeducibleFormato>;
  tipo_aplicacion: Record<string, TipoAplicacion>;
}

export interface DeducibleFormato {
  patrones: string[];
  ejemplo: string;
  valor_2024?: number;
  rango_tipico?: {
    min: number;
    max: number;
  };
}

export interface TipoAplicacion {
  terminos: string[];
  severidad?: string;
  descripcion: string;
}

export interface LegalTerm {
  terminos: string[];
  prevalencia?: string;
  descripcion: string;
  severidad?: string;
}

export interface AlertaDefinicion {
  id: string;
  titulo: string;
  descripcion: string;
  impacto?: string;
  recomendacion?: string;
  ventaja?: string;
}

function loadThesaurus(): ThesaurusData {
  if (thesaurusCache) {
    return thesaurusCache;
  }

  try {
    const data = fs.readFileSync(thesaurusPath, 'utf-8');
    thesaurusCache = JSON.parse(data);
    console.log('📚 [Thesaurus Service] Loaded version:', thesaurusCache?.version);
    return thesaurusCache!;
  } catch (error) {
    console.error('❌ [Thesaurus Service] Failed to load thesaurus:', error);
    throw new Error('Failed to load thesaurus data');
  }
}

export const thesaurusService = {
  /**
   * Obtiene el tesauro completo
   */
  getThesaurus: (): ThesaurusData => {
    return loadThesaurus();
  },

  /**
   * Obtiene la definición de una cobertura de la plantilla
   */
  getCoberturaDefinition: (nombrePlantilla: string): CoberturaDefinition | null => {
    const thesaurus = loadThesaurus();
    return thesaurus.coberturas_plantilla[nombrePlantilla] || null;
  },

  /**
   * Lista todas las coberturas de la plantilla PYME
   */
  listCoberturas: (): string[] => {
    const thesaurus = loadThesaurus();
    return Object.keys(thesaurus.coberturas_plantilla);
  },

  /**
   * Normaliza un término usando el tesauro
   */
  normalizeTerm: (term: string): string => {
    const normalized = term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    return normalized;
  },

  /**
   * Obtiene sinónimos para un término estándar
   */
  getSynonyms: (standardTerm: string): string[] => {
    const definition = thesaurusService.getCoberturaDefinition(standardTerm);
    if (definition) {
      return definition.sinonimos;
    }
    return [];
  },

  /**
   * Expande una query con términos relacionados del tesauro
   */
  expandQuery: (query: string, coberturaNombre?: string): string[] => {
    const terms: string[] = [query];
    const normalizedQuery = thesaurusService.normalizeTerm(query);

    // Si se especifica una cobertura de plantilla, usar sus términos de búsqueda
    if (coberturaNombre) {
      const definition = thesaurusService.getCoberturaDefinition(coberturaNombre);
      if (definition) {
        terms.push(...definition.terminos_busqueda);
      }
    }

    // Buscar en todas las coberturas si el query coincide con algún sinónimo
    const thesaurus = loadThesaurus();
    for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
      const sinonimosNormalizados = definicion.sinonimos.map(s => 
        thesaurusService.normalizeTerm(s)
      );
      
      if (sinonimosNormalizados.includes(normalizedQuery) || 
          thesaurusService.normalizeTerm(nombre).includes(normalizedQuery)) {
        terms.push(nombre);
        terms.push(...definicion.terminos_busqueda);
      }
    }

    // Eliminar duplicados
    return [...new Set(terms)];
  },

  /**
   * Encuentra la cobertura de plantilla que mejor coincida con un término
   */
  matchCobertura: (term: string): { nombre: string; definicion: CoberturaDefinition; confidence: number } | null => {
    const normalizedTerm = thesaurusService.normalizeTerm(term);
    const thesaurus = loadThesaurus();
    let bestMatch: { nombre: string; definicion: CoberturaDefinition; confidence: number } | null = null;

    for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
      // Coincidencia exacta con nombre
      if (thesaurusService.normalizeTerm(nombre) === normalizedTerm) {
        return { nombre, definicion, confidence: 1.0 };
      }

      // Coincidencia con sinónimos
      const sinonimosNormalizados = definicion.sinonimos.map(s => 
        thesaurusService.normalizeTerm(s)
      );
      
      if (sinonimosNormalizados.includes(normalizedTerm)) {
        return { nombre, definicion, confidence: 0.9 };
      }

      // Coincidencia parcial
      const partialMatch = sinonimosNormalizados.some(s => 
        s.includes(normalizedTerm) || normalizedTerm.includes(s)
      );
      
      if (partialMatch && (!bestMatch || bestMatch.confidence < 0.7)) {
        bestMatch = { nombre, definicion, confidence: 0.7 };
      }
    }

    return bestMatch;
  },

  /**
   * Obtiene los patrones de regex para parsing de deducibles
   */
  getDeductiblePatterns: (): Record<string, DeducibleFormato> => {
    const thesaurus = loadThesaurus();
    return thesaurus.deducibles.formatos;
  },

  /**
   * Obtiene los tipos de aplicación de deducibles
   */
  getDeductibleTypes: (): Record<string, TipoAplicacion> => {
    const thesaurus = loadThesaurus();
    return thesaurus.deducibles.tipo_aplicacion;
  },

  /**
   * Obtiene SMMLV y UVT actuales
   */
  getSalaryValues: (): { smmlv: number; uvt: number } => {
    const thesaurus = loadThesaurus();
    return {
      smmlv: thesaurus.metadata.salary_value_2024,
      uvt: thesaurus.metadata.uvt_value_2024,
    };
  },

  /**
   * Obtiene definición de una alerta por ID
   */
  getAlertDefinition: (alertId: string): AlertaDefinicion | null => {
    const thesaurus = loadThesaurus();
    
    const allAlerts = [
      ...thesaurus.alertas_auditores.criticas,
      ...thesaurus.alertas_auditores.atencion,
      ...thesaurus.alertas_auditores.destacadas,
    ];

    return allAlerts.find(a => a.id === alertId) || null;
  },

  /**
   * Lista todas las alertas de auditoría
   */
  listAllAlerts: (): {
    criticas: AlertaDefinicion[];
    atencion: AlertaDefinicion[];
    destacadas: AlertaDefinicion[];
  } => {
    const thesaurus = loadThesaurus();
    return thesaurus.alertas_auditores;
  },

  /**
   * Detecta términos legales en un texto
   */
  detectLegalTerms: (text: string): Array<{ term: string; type: string; description: string }> => {
    const thesaurus = loadThesaurus();
    const detected: Array<{ term: string; type: string; description: string }> = [];
    const normalizedText = thesaurusService.normalizeTerm(text);

    for (const [tipo, definicion] of Object.entries(thesaurus.terminos_legales)) {
      for (const termino of definicion.terminos) {
        if (normalizedText.includes(thesaurusService.normalizeTerm(termino))) {
          detected.push({
            term: termino,
            type: tipo,
            description: definicion.descripcion,
          });
        }
      }
    }

    return detected;
  },

  /**
   * Recarga el tesauro (útil para hot-reload en desarrollo)
   */
  reload: (): void => {
    thesaurusCache = null;
    loadThesaurus();
    console.log('🔄 [Thesaurus Service] Reloaded');
  },
};

console.log('📚 [Thesaurus Service] Initialized');
