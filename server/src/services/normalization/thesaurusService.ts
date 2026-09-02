import fs from 'fs';
import path from 'path';
import { assertTaxonomyBundle, TaxonomyBundle } from '../../schemas/domainBundleSchema';
import { loadDomainJson, hasDomainSpecificFile } from '../domainBundleLoader';

function resolveLegacyThesaurusPath(): string {
  const candidates = [
    path.join(__dirname, '../../data/thesaurus.json'),
    path.join(__dirname, '../data/thesaurus.json'),
    path.join(process.cwd(), 'src/data/thesaurus.json'),
    path.join(process.cwd(), 'server/src/data/thesaurus.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0]!;
}

let legacyThesaurusCache: ThesaurusData | null = null;

function loadLegacyThesaurus(): ThesaurusData {
  if (legacyThesaurusCache) {
    return legacyThesaurusCache;
  }

  const legacyPath = resolveLegacyThesaurusPath();
  const data = JSON.parse(fs.readFileSync(legacyPath, 'utf-8')) as ThesaurusData;
  legacyThesaurusCache = data;
  return data;
}

// Cache por dominio
const thesaurusCache = new Map<string, ThesaurusData>();

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

function toKebabId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildThesaurusData(
  domain: string,
  taxonomy: TaxonomyBundle,
  legacy: ThesaurusData
): ThesaurusData {
  const coberturas_plantilla: Record<string, CoberturaDefinition> = {};

  if (domain === 'pyme') {
    // Para PYME conservamos el tesauro histórico detallado para mantener
    // comportamiento idéntico al pre-cambio.
    Object.assign(coberturas_plantilla, legacy.coberturas_plantilla);
  }

  // Cargar variantes específicas de thesaurus.json si existen para el dominio
  let domainThesaurusVariants: Record<string, string[]> = {};
  if (hasDomainSpecificFile(domain, 'thesaurus.json')) {
    try {
      const thesaurusObj = loadDomainJson<{
        entries?: Array<{ canonicalName: string; variants: string[] }>;
      }>(domain, 'thesaurus.json');
      if (thesaurusObj?.entries && Array.isArray(thesaurusObj.entries)) {
        for (const entry of thesaurusObj.entries) {
          if (entry.canonicalName && Array.isArray(entry.variants)) {
            domainThesaurusVariants[entry.canonicalName] = entry.variants;
          }
        }
      }
    } catch (err) {
      console.warn(`[ThesaurusService] Could not parse thesaurus.json for domain ${domain}:`, err);
    }
  }

  // Aseguramos que todas las categorías del bundle tengan una definición completa
  for (const category of taxonomy.categories) {
    const existing = coberturas_plantilla[category.name];
    const aliases = (category as any).synonyms || category.aliases || [];
    const thesaurusVariants = domainThesaurusVariants[category.name] || [];
    const combinedSynonyms = Array.from(
      new Set([...(existing?.sinonimos || []), ...aliases, ...thesaurusVariants])
    );

    coberturas_plantilla[category.name] = {
      id: existing?.id || toKebabId(category.name),
      sinonimos: combinedSynonyms,
      terminos_busqueda: combinedSynonyms,
      exclusiones_comunes: existing?.exclusiones_comunes,
      alertas_criticas: existing?.alertas_criticas,
      deducibles_tipicos: existing?.deducibles_tipicos,
      tipos: existing?.tipos,
      nota_tecnica: existing?.nota_tecnica,
    };
  }

  const metadata = taxonomy.metadata
    ? {
        region: taxonomy.metadata.region ?? legacy.metadata.region,
        currency: taxonomy.metadata.currency ?? legacy.metadata.currency,
        salary_reference: taxonomy.metadata.salaryReference ?? legacy.metadata.salary_reference,
        salary_value_2024: taxonomy.metadata.salaryValue2024 ?? legacy.metadata.salary_value_2024,
        uvt_value_2024: taxonomy.metadata.uvtValue2024 ?? legacy.metadata.uvt_value_2024,
      }
    : legacy.metadata;

  return {
    version: taxonomy.version ?? legacy.version,
    last_updated: new Date().toISOString().split('T')[0]!,
    metadata,
    coberturas_plantilla,
    deducibles: legacy.deducibles,
    terminos_legales: legacy.terminos_legales,
    alertas_auditores: legacy.alertas_auditores,
  };
}

function loadThesaurus(domain: string = 'pyme'): ThesaurusData {
  if (thesaurusCache.has(domain)) {
    return thesaurusCache.get(domain)!;
  }

  try {
    const taxonomy = assertTaxonomyBundle(loadDomainJson(domain, 'taxonomy.json'));
    const legacy = loadLegacyThesaurus();
    const data = buildThesaurusData(domain, taxonomy, legacy);
    thesaurusCache.set(domain, data);
    console.log('📚 [Thesaurus Service] Loaded version:', data.version, 'domain:', domain);
    return data;
  } catch (error) {
    console.error('❌ [Thesaurus Service] Failed to load thesaurus:', error);
    throw new Error('Failed to load thesaurus data');
  }
}

export const thesaurusService = {
  /**
   * Obtiene el tesauro completo para un dominio
   */
  getThesaurus: (domain?: string): ThesaurusData => {
    return loadThesaurus(domain ?? 'pyme');
  },

  /**
   * Obtiene la definición de una cobertura de la plantilla
   */
  getCoberturaDefinition: (
    nombrePlantilla: string,
    domain?: string
  ): CoberturaDefinition | null => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    return thesaurus.coberturas_plantilla[nombrePlantilla] || null;
  },

  /**
   * Lista todas las coberturas de la plantilla para un dominio
   */
  listCoberturas: (domain?: string): string[] => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
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
  getSynonyms: (standardTerm: string, domain?: string): string[] => {
    const definition = thesaurusService.getCoberturaDefinition(standardTerm, domain);
    if (definition) {
      return definition.sinonimos;
    }
    return [];
  },

  /**
   * Expande una query con términos relacionados del tesauro
   */
  expandQuery: (query: string, coberturaNombre?: string, domain?: string): string[] => {
    const terms: string[] = [query];
    const normalizedQuery = thesaurusService.normalizeTerm(query);

    // Si se especifica una cobertura de plantilla, usar sus términos de búsqueda
    if (coberturaNombre) {
      const definition = thesaurusService.getCoberturaDefinition(coberturaNombre, domain);
      if (definition) {
        terms.push(...definition.terminos_busqueda);
      }
    }

    // Buscar en todas las coberturas si el query coincide con algún sinónimo
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
      const sinonimosNormalizados = definicion.sinonimos.map((s) =>
        thesaurusService.normalizeTerm(s)
      );

      if (
        sinonimosNormalizados.includes(normalizedQuery) ||
        thesaurusService.normalizeTerm(nombre).includes(normalizedQuery)
      ) {
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
  matchCobertura: (
    term: string,
    domain?: string
  ): { nombre: string; definicion: CoberturaDefinition; confidence: number } | null => {
    const normalizedTerm = thesaurusService.normalizeTerm(term);
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    let bestMatch: { nombre: string; definicion: CoberturaDefinition; confidence: number } | null =
      null;

    for (const [nombre, definicion] of Object.entries(thesaurus.coberturas_plantilla)) {
      // Coincidencia exacta con nombre
      if (thesaurusService.normalizeTerm(nombre) === normalizedTerm) {
        return { nombre, definicion, confidence: 1.0 };
      }

      // Coincidencia con sinónimos
      const sinonimosNormalizados = definicion.sinonimos.map((s) =>
        thesaurusService.normalizeTerm(s)
      );

      if (sinonimosNormalizados.includes(normalizedTerm)) {
        return { nombre, definicion, confidence: 0.9 };
      }

      // Coincidencia parcial
      const partialMatch = sinonimosNormalizados.some(
        (s) => s.includes(normalizedTerm) || normalizedTerm.includes(s)
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
  getDeductiblePatterns: (domain?: string): Record<string, DeducibleFormato> => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    return thesaurus.deducibles.formatos;
  },

  /**
   * Obtiene los tipos de aplicación de deducibles
   */
  getDeductibleTypes: (domain?: string): Record<string, TipoAplicacion> => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    return thesaurus.deducibles.tipo_aplicacion;
  },

  /**
   * Obtiene SMMLV y UVT actuales
   */
  getSalaryValues: (domain?: string): { smmlv: number; uvt: number } => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    return {
      smmlv: thesaurus.metadata.salary_value_2024,
      uvt: thesaurus.metadata.uvt_value_2024,
    };
  },

  /**
   * Obtiene definición de una alerta por ID
   */
  getAlertDefinition: (alertId: string, domain?: string): AlertaDefinicion | null => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');

    const allAlerts = [
      ...thesaurus.alertas_auditores.criticas,
      ...thesaurus.alertas_auditores.atencion,
      ...thesaurus.alertas_auditores.destacadas,
    ];

    return allAlerts.find((a) => a.id === alertId) || null;
  },

  /**
   * Lista todas las alertas de auditoría
   */
  listAllAlerts: (
    domain?: string
  ): {
    criticas: AlertaDefinicion[];
    atencion: AlertaDefinicion[];
    destacadas: AlertaDefinicion[];
  } => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
    return thesaurus.alertas_auditores;
  },

  /**
   * Detecta términos legales en un texto
   */
  detectLegalTerms: (
    text: string,
    domain?: string
  ): Array<{ term: string; type: string; description: string }> => {
    const thesaurus = loadThesaurus(domain ?? 'pyme');
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
  reload: (domain?: string): void => {
    const d = domain ?? 'pyme';
    thesaurusCache.delete(d);
    loadThesaurus(d);
    console.log('🔄 [Thesaurus Service] Reloaded domain:', d);
  },
};

console.log('📚 [Thesaurus Service] Initialized');
