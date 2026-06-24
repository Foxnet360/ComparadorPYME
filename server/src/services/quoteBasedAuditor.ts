/**
 * Quote-Based Auditor Service
 * Analyzes quote data without RAG dependency
 * Generates audit alerts from coverage data, deductibles, and special conditions
 */

// Local type definitions to avoid importing from outside rootDir
interface CoverageItem {
  name: string;
  value: string;
  deductible?: string;
  canonicalName?: string;
  categoryId?: number | null;
  matchConfidence?: number;
  matchMethod?: string | null;
}

interface AlertItem {
  level: 'CRITICAL' | 'WARNING' | 'GOOD' | 'INFO';
  title: string;
  description: string;
  clauseReference?: string;
  sourceDocument?: string;
}

interface QuoteAnalysis {
  insurerName: string;
  policyName: string;
  priceAnnual: number;
  currency: string;
  coverages: CoverageItem[];
  alerts: AlertItem[];
  rawText?: string;
  scoringBreakdown?: any;
  clientAnalysis?: string;
  technicalAnalysis?: string;
  score?: number;
  deductibles?: string;
}

// Canonical categories for PYME insurance
const CANONICAL_CATEGORIES = [
  { id: 1, name: 'Incendio (Edificio y Contenidos)' },
  { id: 2, name: 'Lucro Cesante' },
  { id: 3, name: 'Sustracción / Hurto' },
  { id: 4, name: 'Equipo Eléctrico y Electrónico' },
  { id: 5, name: 'Rotura de Maquinaria' },
  { id: 6, name: 'Responsabilidad Civil (RCE)' },
  { id: 7, name: 'Vidrios Planos' },
  { id: 8, name: 'Manejo Global / Infidelidad' },
  { id: 9, name: 'Transporte de Mercancías' },
  { id: 10, name: 'Transporte de Valores' },
  { id: 11, name: 'Asistencia PYME' },
  { id: 12, name: 'Asistencia Legal' },
  { id: 13, name: 'Huelga, Motín, Asonada (HMACC)' },
  { id: 14, name: 'Terremoto y Eventos Catastróficos' }
];

export interface DeductibleRisk {
  coverageName: string;
  deductible: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number; // 0-100
  recommendation: string;
}

export interface MissingCoverage {
  categoryName: string;
  categoryId: number;
  impact: 'HIGH' | 'MEDIUM';
  reason: string;
}

export interface SpecialCondition {
  text: string;
  impact: 'CRITICAL' | 'WARNING' | 'INFO';
  coverageName?: string;
}

export interface NegotiationPoint {
  type: 'deductible' | 'coverage' | 'price';
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  potentialSavings?: string;
}

export interface CompetitiveAdvantage {
  type: 'exclusive_coverage' | 'better_price' | 'better_deductible' | 'more_coverages';
  description: string;
}

export interface ProfileRecommendation {
  profile: string; // e.g., 'restaurant', 'retail', 'manufacturing', 'office'
  priorityCoverages: string[];
  recommendation: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface QuoteAuditResult {
  insurerName: string;
  deductibleRisks: DeductibleRisk[];
  missingCoverages: MissingCoverage[];
  specialConditions: SpecialCondition[];
  alerts: AlertItem[];
  negotiationPoints: NegotiationPoint[];
  competitiveAdvantages: CompetitiveAdvantage[];
  profileRecommendations: ProfileRecommendation[];
  overallRiskScore: number; // 0-100
  summary: string;
}

/**
 * Parse deductible and determine risk level
 */
const analyzeDeductible = (coverage: CoverageItem): DeductibleRisk => {
  const deductible = coverage.deductible?.toUpperCase().trim() || '';
  const value = coverage.value?.toUpperCase().trim() || '';

  // No deductible - low risk
  if (!deductible || deductible === 'NO APLICA' || deductible === 'SIN DEDUCIBLE' || deductible === 'INCLUIDO') {
    return {
      coverageName: coverage.name,
      deductible: coverage.deductible || 'No aplica',
      riskLevel: 'LOW',
      score: 90,
      recommendation: 'Sin deducible - condición favorable'
    };
  }

  // Unspecified - critical risk
  if (deductible === 'NO ESPECIFICADO' || deductible === 'N/A') {
    return {
      coverageName: coverage.name,
      deductible: 'NO ESPECIFICADO',
      riskLevel: 'CRITICAL',
      score: 20,
      recommendation: '⚠️ CRÍTICO: Deducible no especificado. Solicitar aclaración inmediata al asegurador.'
    };
  }

  // Parse percentage
  const percentMatch = deductible.match(/(\d+)%/);
  if (percentMatch) {
    const percentage = parseInt(percentMatch[1]);
    if (percentage > 10) {
      return {
        coverageName: coverage.name,
        deductible: `${percentage}%`,
        riskLevel: 'HIGH',
        score: Math.max(30, 60 - percentage),
        recommendation: `⚠️ Deducible alto (${percentage}%). Supera el 10% estándar del mercado.`
      };
    } else if (percentage > 0) {
      return {
        coverageName: coverage.name,
        deductible: `${percentage}%`,
        riskLevel: 'MEDIUM',
        score: Math.max(50, 80 - percentage * 2),
        recommendation: `Deducible moderado (${percentage}%). Dentro del rango aceptable.`
      };
    }
  }

  // Parse SMMLV
  const smmlvMatch = deductible.match(/(\d+)\s*SMMLV/i);
  if (smmlvMatch) {
    const smmlv = parseInt(smmlvMatch[1]);
    if (smmlv > 5) {
      return {
        coverageName: coverage.name,
        deductible: `${smmlv} SMMLV`,
        riskLevel: 'HIGH',
        score: Math.max(30, 70 - smmlv * 5),
        recommendation: `⚠️ Deducible elevado en términos absolutos (${smmlv} SMMLV).`
      };
    } else {
      return {
        coverageName: coverage.name,
        deductible: `${smmlv} SMMLV`,
        riskLevel: 'MEDIUM',
        score: Math.max(60, 85 - smmlv * 3),
        recommendation: `Deducible estándar (${smmlv} SMMLV).`
      };
    }
  }

  // Default
  return {
    coverageName: coverage.name,
    deductible: coverage.deductible || 'Desconocido',
    riskLevel: 'MEDIUM',
    score: 50,
    recommendation: `Revisar formato de deducible: ${coverage.deductible}`
  };
};

/**
 * Detect missing canonical coverages
 */
const detectMissingCoverages = (quote: QuoteAnalysis): MissingCoverage[] => {
  const missing: MissingCoverage[] = [];
  const coverageNames = (quote.coverages || []).map(c => c.name?.toLowerCase() || '');

  for (const category of CANONICAL_CATEGORIES) {
    const categoryNameLower = category.name.toLowerCase();
    
    // Check if any coverage matches this category
    const hasCoverage = coverageNames.some((name: string) => {
      // Direct match
      if (name.includes(categoryNameLower)) return true;
      
      // Common abbreviations
      const aliases: Record<string, string[]> = {
        'responsabilidad civil (rce)': ['rc', 'rce', 'responsabilidad civil'],
        'incendio (edificio y contenidos)': ['incendio', 'edificio', 'contenidos'],
        'equipo eléctrico y electrónico': ['equipo electronico', 'equipo electrico', 'corto circuito'],
        'huelga, motín, asonada (hmacc)': ['huelga', 'motin', 'asonada', 'hmacc'],
        'terremoto y eventos catastróficos': ['terremoto', 'catastroficos', 'sismo'],
      };
      
      const categoryAliases = aliases[categoryNameLower] || [];
      return categoryAliases.some((alias: string) => name.includes(alias));
    });

    if (!hasCoverage) {
      // Determine impact based on coverage criticality
      const highImpactCategories = [
        'Incendio (Edificio y Contenidos)',
        'Responsabilidad Civil (RCE)',
        'Sustracción / Hurto'
      ];
      
      missing.push({
        categoryName: category.name,
        categoryId: category.id,
        impact: highImpactCategories.includes(category.name) ? 'HIGH' : 'MEDIUM',
        reason: `Cobertura canónica #${category.id} no incluida en la cotización`
      });
    }
  }

  return missing;
};

/**
 * Extract special conditions from raw text
 */
const extractSpecialConditions = (quote: QuoteAnalysis): SpecialCondition[] => {
  const conditions: SpecialCondition[] = [];
  const rawText = quote.rawText || quote.deductibles || '';
  
  if (!rawText) return conditions;

  // Patterns for special conditions
  const patterns = [
    {
      regex: /(?:condici[oó]n especial|nota importante|advertencia):\s*([^.]+)/gi,
      impact: 'WARNING' as const
    },
    {
      regex: /(?:sujeto a|bajo la condici[oó]n de):\s*([^.]+)/gi,
      impact: 'WARNING' as const
    },
    {
      regex: /(?:no cubre|excluye|exclusi[oó]n total):\s*([^.]+)/gi,
      impact: 'CRITICAL' as const
    },
    {
      regex: /(?:limitado a|m[aá]ximo|tope):\s*([^.]+)/gi,
      impact: 'WARNING' as const
    }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(rawText)) !== null) {
      const text = match[1].trim();
      if (text.length > 10 && !conditions.some(c => c.text === text)) {
        conditions.push({
          text,
          impact: pattern.impact,
          coverageName: extractCoverageFromContext(rawText, match.index)
        });
      }
    }
  }

  return conditions;
};

/**
 * Try to identify which coverage a condition applies to based on context
 */
const extractCoverageFromContext = (text: string, position: number): string | undefined => {
  // Look backwards for coverage names
  const beforeText = text.substring(Math.max(0, position - 200), position);
  
  for (const category of CANONICAL_CATEGORIES) {
    if (beforeText.toLowerCase().includes(category.name.toLowerCase())) {
      return category.name;
    }
  }
  
  return undefined;
};

/**
 * Generate audit alerts from analysis results
 */
const generateAlerts = (
  deductibleRisks: DeductibleRisk[],
  missingCoverages: MissingCoverage[],
  specialConditions: SpecialCondition[]
): AlertItem[] => {
  const alerts: AlertItem[] = [];

  // Deductible alerts
  for (const risk of deductibleRisks) {
    if (risk.riskLevel === 'CRITICAL') {
      alerts.push({
        level: 'CRITICAL',
        title: `Deducible crítico: ${risk.coverageName}`,
        description: risk.recommendation,
        clauseReference: `Deducible: ${risk.deductible}`
      });
    } else if (risk.riskLevel === 'HIGH') {
      alerts.push({
        level: 'WARNING',
        title: `Deducible elevado: ${risk.coverageName}`,
        description: risk.recommendation,
        clauseReference: `Deducible: ${risk.deductible}`
      });
    }
  }

  // Missing coverage alerts
  const highImpactMissing = missingCoverages.filter((m: MissingCoverage) => m.impact === 'HIGH');
  if (highImpactMissing.length > 0) {
    alerts.push({
      level: 'CRITICAL',
      title: `Faltan ${highImpactMissing.length} coberturas críticas`,
      description: `Coberturas faltantes: ${highImpactMissing.map((m: MissingCoverage) => m.categoryName).join(', ')}`,
      clauseReference: 'Plantilla PYME canónica'
    });
  }

  const mediumImpactMissing = missingCoverages.filter((m: MissingCoverage) => m.impact === 'MEDIUM');
  if (mediumImpactMissing.length > 0) {
    alerts.push({
      level: 'WARNING',
      title: `Faltan ${mediumImpactMissing.length} coberturas adicionales`,
      description: `Considerar solicitar: ${mediumImpactMissing.slice(0, 3).map((m: MissingCoverage) => m.categoryName).join(', ')}${mediumImpactMissing.length > 3 ? '...' : ''}`,
      clauseReference: 'Plantilla PYME canónica'
    });
  }

  // Special condition alerts
  for (const condition of specialConditions) {
    if (condition.impact === 'CRITICAL') {
      alerts.push({
        level: 'CRITICAL',
        title: `Condición crítica encontrada`,
        description: condition.text,
        clauseReference: condition.coverageName
      });
    } else if (condition.impact === 'WARNING') {
      alerts.push({
        level: 'WARNING',
        title: `Condición especial: ${condition.coverageName || 'General'}`,
        description: condition.text,
        clauseReference: condition.coverageName
      });
    }
  }

  return alerts;
};

/**
 * Detect negotiation points for a single quote
 */
const detectNegotiationPoints = (quote: QuoteAnalysis, allQuotes: QuoteAnalysis[]): NegotiationPoint[] => {
  const points: NegotiationPoint[] = [];
  
  // 1. High deductibles compared to market average
  const deductibleRisks = (quote.coverages || []).map(analyzeDeductible);
  const highDeductibleRisks = deductibleRisks.filter(r => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL');
  
  if (highDeductibleRisks.length > 0) {
    for (const risk of highDeductibleRisks.slice(0, 2)) {
      points.push({
        type: 'deductible',
        title: `Negociar deducible de ${risk.coverageName}`,
        description: `El deducible actual (${risk.deductible}) es elevado. Solicitar reducción al estándar de mercado.`,
        priority: risk.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        potentialSavings: 'Reducción de 10-30% en siniestros menores'
      });
    }
  }
  
  // 2. Price comparison - if this is the most expensive
  const avgPrice = allQuotes.reduce((sum, q) => sum + (q.priceAnnual || 0), 0) / allQuotes.length;
  if (quote.priceAnnual > avgPrice * 1.15) {
    const savings = Math.round(((quote.priceAnnual - avgPrice) / quote.priceAnnual) * 100);
    points.push({
      type: 'price',
      title: 'Prima por encima del promedio',
      description: `Esta cotización es ${savings}% más cara que el promedio. Negociar descuento o mejorar coberturas.`,
      priority: 'MEDIUM',
      potentialSavings: `Hasta ${savings}% de reducción de prima`
    });
  }
  
  // 3. Missing critical coverages
  const missing = detectMissingCoverages(quote);
  const highImpactMissing = missing.filter(m => m.impact === 'HIGH');
  if (highImpactMissing.length > 0) {
    points.push({
      type: 'coverage',
      title: 'Solicitar coberturas críticas faltantes',
      description: `Faltan ${highImpactMissing.length} coberturas esenciales: ${highImpactMissing.slice(0, 3).map(m => m.categoryName).join(', ')}`,
      priority: 'HIGH',
      potentialSavings: 'Evitar exposición significativa'
    });
  }
  
  return points;
};

/**
 * Detect competitive advantages compared to other quotes
 */
const detectCompetitiveAdvantages = (quote: QuoteAnalysis, allQuotes: QuoteAnalysis[]): CompetitiveAdvantage[] => {
  const advantages: CompetitiveAdvantage[] = [];
  
  if (!allQuotes || allQuotes.length < 2) return advantages;
  
  // 1. Better price
  const prices = allQuotes.map(q => q.priceAnnual || 0).filter(p => p > 0);
  const minPrice = Math.min(...prices);
  if (quote.priceAnnual === minPrice && prices.length > 1) {
    const savings = Math.round(((prices.reduce((a, b) => a + b, 0) / prices.length - minPrice) / (prices.reduce((a, b) => a + b, 0) / prices.length)) * 100);
    advantages.push({
      type: 'better_price',
      description: `Prima más baja del mercado (${savings}% bajo el promedio)`
    });
  }
  
  // 2. More coverages
  const coverageCounts = allQuotes.map(q => ({
    insurer: q.insurerName,
    count: (q.coverages || []).filter(c => c.value && c.value !== 'NO ASEGURADO').length
  }));
  const maxCoverages = Math.max(...coverageCounts.map(c => c.count));
  const quoteCoverageCount = (quote.coverages || []).filter(c => c.value && c.value !== 'NO ASEGURADO').length;
  if (quoteCoverageCount === maxCoverages && coverageCounts.filter(c => c.count === maxCoverages).length === 1) {
    advantages.push({
      type: 'more_coverages',
      description: `Mayor cantidad de coberturas incluidas (${quoteCoverageCount} coberturas)`
    });
  }
  
  // 3. Better deductibles
  const deductibleScores = allQuotes.map(q => {
    const risks = (q.coverages || []).map(analyzeDeductible);
    return {
      insurer: q.insurerName,
      avgScore: risks.length > 0 ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length : 0
    };
  });
  const maxDeductibleScore = Math.max(...deductibleScores.map(d => d.avgScore));
  const quoteDeductibleScore = deductibleScores.find(d => d.insurer === quote.insurerName)?.avgScore || 0;
  if (quoteDeductibleScore === maxDeductibleScore && deductibleScores.filter(d => d.avgScore === maxDeductibleScore).length === 1) {
    advantages.push({
      type: 'better_deductible',
      description: 'Mejores condiciones de deducibles del mercado'
    });
  }
  
  // 4. Exclusive coverages (coverages that only this insurer has)
  const quoteCoverageNames = (quote.coverages || []).map(c => c.name?.toLowerCase() || '');
  const otherQuotes = allQuotes.filter(q => q.insurerName !== quote.insurerName);
  const otherCoverageNames = new Set(otherQuotes.flatMap(q => (q.coverages || []).map(c => c.name?.toLowerCase() || '')));
  
  const exclusiveCoverages = quoteCoverageNames.filter(name => !otherCoverageNames.has(name) && name.length > 0);
  if (exclusiveCoverages.length > 0) {
    advantages.push({
      type: 'exclusive_coverage',
      description: `Coberturas exclusivas: ${exclusiveCoverages.slice(0, 2).join(', ')}${exclusiveCoverages.length > 2 ? '...' : ''}`
    });
  }
  
  return advantages;
};

/**
 * Detect profile-based recommendations
 * Analyzes coverage gaps based on industry profile
 */
const detectProfileRecommendations = (quote: QuoteAnalysis): ProfileRecommendation[] => {
  const recommendations: ProfileRecommendation[] = [];
  const coverageNames = (quote.coverages || []).map(c => c.name?.toLowerCase() || '');
  
  // Helper to check if coverage exists
  const hasCoverage = (keywords: string[]): boolean => {
    return coverageNames.some(name => keywords.some(kw => name.includes(kw.toLowerCase())));
  };
  
  // Restaurant profile
  const restaurantKeywords = ['restaurant', 'restaurante', 'cocina', 'alimentos', 'comida'];
  const isRestaurant = restaurantKeywords.some(kw => quote.rawText?.toLowerCase().includes(kw) || quote.policyName?.toLowerCase().includes(kw));
  
  if (isRestaurant) {
    const missingCritical: string[] = [];
    if (!hasCoverage(['responsabilidad civil', 'rce', 'rc'])) missingCritical.push('Responsabilidad Civil');
    if (!hasCoverage(['incendio', 'edificio'])) missingCritical.push('Incendio');
    if (!hasCoverage(['equipo electrico', 'equipo electronico'])) missingCritical.push('Equipo Eléctrico');
    
    recommendations.push({
      profile: 'Restaurante',
      priorityCoverages: ['Responsabilidad Civil', 'Incendio', 'Equipo Eléctrico'],
      recommendation: missingCritical.length > 0 
        ? `Para restaurantes, las coberturas críticas son RC (clientes), Incendio (cocina) y Equipo Eléctrico (neveras). Faltan: ${missingCritical.join(', ')}`
        : '✅ Restaurante: Todas las coberturas críticas están incluidas',
      riskLevel: missingCritical.length > 1 ? 'HIGH' : missingCritical.length > 0 ? 'MEDIUM' : 'LOW'
    });
  }
  
  // Retail profile
  const retailKeywords = ['retail', 'comercio', 'tienda', 'almacen', 'inventario', 'mercancia'];
  const isRetail = retailKeywords.some(kw => quote.rawText?.toLowerCase().includes(kw) || quote.policyName?.toLowerCase().includes(kw));
  
  if (isRetail) {
    const missingCritical: string[] = [];
    if (!hasCoverage(['sustraccion', 'hurto', 'robo'])) missingCritical.push('Sustracción/Hurto');
    if (!hasCoverage(['transporte'])) missingCritical.push('Transporte de Mercancías');
    if (!hasCoverage(['responsabilidad civil', 'rce', 'rc'])) missingCritical.push('Responsabilidad Civil');
    
    recommendations.push({
      profile: 'Comercio/Retail',
      priorityCoverages: ['Sustracción', 'Transporte', 'Responsabilidad Civil'],
      recommendation: missingCritical.length > 0 
        ? `Para comercio, priorizar Sustracción (inventario), Transporte (mercancías) y RC (clientes). Faltan: ${missingCritical.join(', ')}`
        : '✅ Comercio: Todas las coberturas críticas están incluidas',
      riskLevel: missingCritical.length > 1 ? 'HIGH' : missingCritical.length > 0 ? 'MEDIUM' : 'LOW'
    });
  }
  
  // Manufacturing profile
  const manufacturingKeywords = ['manufactura', 'fabrica', 'produccion', 'industria', 'planta'];
  const isManufacturing = manufacturingKeywords.some(kw => quote.rawText?.toLowerCase().includes(kw) || quote.policyName?.toLowerCase().includes(kw));
  
  if (isManufacturing) {
    const missingCritical: string[] = [];
    if (!hasCoverage(['rotura de maquinaria', 'maquinaria'])) missingCritical.push('Rotura de Maquinaria');
    if (!hasCoverage(['lucro cesante', 'perdida de beneficios'])) missingCritical.push('Lucro Cesante');
    if (!hasCoverage(['responsabilidad civil', 'rce'])) missingCritical.push('Responsabilidad Civil');
    
    recommendations.push({
      profile: 'Manufactura',
      priorityCoverages: ['Rotura de Maquinaria', 'Lucro Cesante', 'Responsabilidad Civil'],
      recommendation: missingCritical.length > 0 
        ? `Para manufactura, priorizar Rotura de Maquinaria, Lucro Cesante (paradas) y RC. Faltan: ${missingCritical.join(', ')}`
        : '✅ Manufactura: Todas las coberturas críticas están incluidas',
      riskLevel: missingCritical.length > 1 ? 'HIGH' : missingCritical.length > 0 ? 'MEDIUM' : 'LOW'
    });
  }
  
  // Office/Service profile
  const officeKeywords = ['oficina', 'consultoria', 'servicios', 'profesional', 'tecnologia'];
  const isOffice = officeKeywords.some(kw => quote.rawText?.toLowerCase().includes(kw) || quote.policyName?.toLowerCase().includes(kw));
  
  if (isOffice) {
    const missingCritical: string[] = [];
    if (!hasCoverage(['equipo electronico', 'equipo electrico'])) missingCritical.push('Equipo Electrónico');
    if (!hasCoverage(['responsabilidad civil', 'rce'])) missingCritical.push('Responsabilidad Civil');
    if (!hasCoverage(['incendio'])) missingCritical.push('Incendio');
    
    recommendations.push({
      profile: 'Oficina/Servicios',
      priorityCoverages: ['Equipo Electrónico', 'Responsabilidad Civil', 'Incendio'],
      recommendation: missingCritical.length > 0 
        ? `Para oficinas, priorizar Equipo Electrónico (computadores), RC (errores profesionales) e Incendio. Faltan: ${missingCritical.join(', ')}`
        : '✅ Oficina: Todas las coberturas críticas están incluidas',
      riskLevel: missingCritical.length > 1 ? 'HIGH' : missingCritical.length > 0 ? 'MEDIUM' : 'LOW'
    });
  }
  
  // If no profile detected, add generic recommendation
  if (recommendations.length === 0) {
    const missingCritical: string[] = [];
    if (!hasCoverage(['incendio'])) missingCritical.push('Incendio');
    if (!hasCoverage(['responsabilidad civil', 'rce'])) missingCritical.push('Responsabilidad Civil');
    if (!hasCoverage(['sustraccion', 'hurto'])) missingCritical.push('Sustracción');
    
    if (missingCritical.length > 0) {
      recommendations.push({
        profile: 'General',
        priorityCoverages: ['Incendio', 'Responsabilidad Civil', 'Sustracción'],
        recommendation: `Coberturas fundamentales para cualquier negocio: ${missingCritical.join(', ')}. Considerar su inclusión.`,
        riskLevel: 'MEDIUM'
      });
    }
  }
  
  return recommendations;
};

/**
 * Main audit function - analyzes a single quote
 */
export const auditQuote = (quote: QuoteAnalysis, allQuotes: QuoteAnalysis[] = []): QuoteAuditResult => {
  const deductibleRisks = (quote.coverages || []).map(analyzeDeductible);
  const missingCoverages = detectMissingCoverages(quote);
  const specialConditions = extractSpecialConditions(quote);
  const alerts = generateAlerts(deductibleRisks, missingCoverages, specialConditions);
  const negotiationPoints = detectNegotiationPoints(quote, allQuotes);
  const competitiveAdvantages = detectCompetitiveAdvantages(quote, allQuotes);
  const profileRecommendations = detectProfileRecommendations(quote);

  // Calculate overall risk score
  const deductibleScore = deductibleRisks.length > 0 
    ? deductibleRisks.reduce((sum: number, r: DeductibleRisk) => sum + r.score, 0) / deductibleRisks.length 
    : 50;
  
  const missingPenalty = missingCoverages.filter(m => m.impact === 'HIGH').length * 10 +
                        missingCoverages.filter(m => m.impact === 'MEDIUM').length * 5;
  
  const conditionPenalty = specialConditions.filter(c => c.impact === 'CRITICAL').length * 15 +
                          specialConditions.filter(c => c.impact === 'WARNING').length * 5;

  const overallRiskScore = Math.max(0, Math.min(100, deductibleScore - missingPenalty - conditionPenalty));

  // Generate summary
  const criticalCount = alerts.filter(a => a.level === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.level === 'WARNING').length;
  
  let summary = `Análisis de ${quote.insurerName}: `;
  if (criticalCount > 0) {
    summary += `${criticalCount} riesgo${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}. `;
  }
  if (warningCount > 0) {
    summary += `${warningCount} advertencia${warningCount > 1 ? 's' : ''}. `;
  }
  if (missingCoverages.length > 0) {
    summary += `Faltan ${missingCoverages.length} coberturas canónicas. `;
  }
  if (negotiationPoints.length > 0) {
    summary += `${negotiationPoints.length} puntos de negociación. `;
  }
  if (competitiveAdvantages.length > 0) {
    summary += `${competitiveAdvantages.length} ventajas competitivas. `;
  }
  if (profileRecommendations.length > 0) {
    const highRiskRecs = profileRecommendations.filter(r => r.riskLevel === 'HIGH');
    if (highRiskRecs.length > 0) {
      summary += `${highRiskRecs.length} recomendación(es) de perfil de alto riesgo. `;
    }
  }
  if (alerts.length === 0 && negotiationPoints.length === 0 && profileRecommendations.filter(r => r.riskLevel === 'HIGH').length === 0) {
    summary += 'Sin hallazgos significativos. Cotización completa.';
  }

  return {
    insurerName: quote.insurerName,
    deductibleRisks,
    missingCoverages,
    specialConditions,
    alerts,
    negotiationPoints,
    competitiveAdvantages,
    profileRecommendations,
    overallRiskScore: Math.round(overallRiskScore),
    summary
  };
};

/**
 * Compare deductibles across multiple quotes for the same coverage
 */
export const compareDeductibles = (quotes: QuoteAnalysis[], coverageName: string): {
  bestInsurer: string;
  worstInsurer: string;
  bestDeductible: string;
  worstDeductible: string;
} | null => {
  const comparisons: { insurer: string; deductible: string; score: number }[] = [];

  for (const quote of quotes) {
    const coverage = quote.coverages?.find((c: CoverageItem) => 
      c.name?.toLowerCase().includes(coverageName.toLowerCase()) ||
      c.canonicalName?.toLowerCase().includes(coverageName.toLowerCase())
    );

    if (coverage) {
      const risk = analyzeDeductible(coverage);
      comparisons.push({
        insurer: quote.insurerName,
        deductible: coverage.deductible || 'NO ESPECIFICADO',
        score: risk.score
      });
    }
  }

  if (comparisons.length === 0) return null;

  comparisons.sort((a, b) => b.score - a.score);
  
  return {
    bestInsurer: comparisons[0].insurer,
    worstInsurer: comparisons[comparisons.length - 1].insurer,
    bestDeductible: comparisons[0].deductible,
    worstDeductible: comparisons[comparisons.length - 1].deductible
  };
};

export default {
  auditQuote,
  compareDeductibles,
  analyzeDeductible
};
