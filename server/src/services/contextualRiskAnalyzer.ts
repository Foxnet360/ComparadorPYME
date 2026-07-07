/**
 * Contextual Risk Analyzer
 * Contextualizes exclusions based on client profile (industry, location, etc.)
 * Transforms generic exclusions into personalized risks
 */

export interface ClientProfile {
  industryType: 'manufactura' | 'comercio' | 'servicios' | 'construccion' | 'transporte' | 'otro';
  locationCity: string;
  locationZone: 'costera' | 'montana' | 'urbana' | 'industrial' | 'rural';
  hasSingleSupplier: boolean;
  employeeCount: number;
  buildingType: 'propio' | 'arrendado' | 'mixto';
  primaryActivity: string;
  annualRevenue?: number;
}

export interface ContextualizedExclusion {
  exclusion: string;
  baseRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  contextualRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  mitigationSuggestions: string[];
  estimatedAdditionalCost?: string;
}

export interface ContextualRiskSummary {
  exclusions: ContextualizedExclusion[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hasProfile: boolean;
}

// Risk multipliers based on client profile
const RISK_MULTIPLIERS: Record<string, Record<string, number>> = {
  inundacion: {
    costera: 3.0, // Critical for coastal areas
    montana: 0.5, // Low for mountain areas
    urbana: 1.5, // Medium-high for urban
    industrial: 1.5,
    rural: 2.0,
  },
  terremoto: {
    costera: 1.5,
    montana: 2.5, // Higher for mountain areas
    urbana: 1.0,
    industrial: 1.0,
    rural: 1.0,
  },
  robo: {
    comercio: 2.0,
    urbana: 1.5,
    industrial: 1.5,
  },
  construccion: {
    construccion: 3.0,
    industrial: 2.0,
    urbana: 1.5,
  },
  proveedor: {
    manufactura: 2.0,
    hasSingleSupplier: 3.0,
  },
};

export const contextualRiskAnalyzer = {
  /**
   * Contextualize exclusions based on client profile
   */
  contextualizeExclusions: (
    exclusions: string[],
    clientProfile?: ClientProfile
  ): ContextualRiskSummary => {
    console.log(`🔍 [contextualRiskAnalyzer] Contextualizing ${exclusions.length} exclusions...`);

    if (!clientProfile) {
      // Return generic analysis without profile
      return {
        exclusions: exclusions.map((exclusion) => ({
          exclusion,
          baseRiskLevel: 'MEDIUM',
          contextualRiskLevel: 'MEDIUM',
          explanation:
            'Análisis genérico. Complete el perfil del cliente para contextualización personalizada.',
          mitigationSuggestions: ['Complete el perfil del cliente'],
          estimatedAdditionalCost: undefined,
        })),
        criticalCount: 0,
        highCount: 0,
        mediumCount: exclusions.length,
        lowCount: 0,
        hasProfile: false,
      };
    }

    const contextualizedExclusions = exclusions.map((exclusion) =>
      contextualizeSingleExclusion(exclusion, clientProfile)
    );

    const criticalCount = contextualizedExclusions.filter(
      (e) => e.contextualRiskLevel === 'CRITICAL'
    ).length;
    const highCount = contextualizedExclusions.filter(
      (e) => e.contextualRiskLevel === 'HIGH'
    ).length;
    const mediumCount = contextualizedExclusions.filter(
      (e) => e.contextualRiskLevel === 'MEDIUM'
    ).length;
    const lowCount = contextualizedExclusions.filter((e) => e.contextualRiskLevel === 'LOW').length;

    console.log(
      `✅ [contextualRiskAnalyzer] Contextualized: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`
    );

    return {
      exclusions: contextualizedExclusions,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      hasProfile: true,
    };
  },

  /**
   * Calculate contextual risk for a specific scenario
   */
  calculateContextualRisk: (
    exclusion: string,
    clientProfile: ClientProfile
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    const contextualized = contextualizeSingleExclusion(exclusion, clientProfile);
    return contextualized.contextualRiskLevel;
  },

  /**
   * Suggest mitigations for a contextualized exclusion
   */
  suggestMitigation: (exclusion: string, clientProfile: ClientProfile): string[] => {
    const contextualized = contextualizeSingleExclusion(exclusion, clientProfile);
    return contextualized.mitigationSuggestions;
  },
};

function contextualizeSingleExclusion(
  exclusion: string,
  profile: ClientProfile
): ContextualizedExclusion {
  const exclusionLower = exclusion.toLowerCase();

  // Determine base risk
  let baseRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

  if (exclusionLower.includes('no cubre') || exclusionLower.includes('exclusión')) {
    baseRiskLevel = 'HIGH';
  } else if (exclusionLower.includes('limitación') || exclusionLower.includes('tope')) {
    baseRiskLevel = 'MEDIUM';
  }

  // Calculate risk multiplier based on profile
  let multiplier = 1.0;
  const explanations: string[] = [];
  const mitigations: string[] = [];
  let estimatedCost: string | undefined;

  // Check for specific exclusion types
  if (exclusionLower.includes('inundación') || exclusionLower.includes('aluvión')) {
    const zoneMultiplier = RISK_MULTIPLIERS['inundacion']?.[profile.locationZone] || 1.0;
    multiplier *= zoneMultiplier;

    if (zoneMultiplier >= 2.0) {
      explanations.push(
        `El cliente está ubicado en zona ${profile.locationZone}, con alta probabilidad de inundaciones.`
      );
    }

    mitigations.push('Contratar cobertura adicional por inundación');
    mitigations.push('Verificar sistema de drenaje y prevención');
    estimatedCost = '$2-5M/año adicional';
  }

  if (exclusionLower.includes('terremoto') || exclusionLower.includes('sismo')) {
    const zoneMultiplier = RISK_MULTIPLIERS['terremoto']?.[profile.locationZone] || 1.0;
    multiplier *= zoneMultiplier;

    if (zoneMultiplier >= 2.0) {
      explanations.push(
        `La ubicación en zona ${profile.locationZone} presenta riesgo sísmico elevado.`
      );
    }

    mitigations.push('Evaluar cobertura de terremoto por separado');
    mitigations.push('Realizar auditoría estructural');
  }

  if (exclusionLower.includes('construcción') || exclusionLower.includes('obra')) {
    if (profile.industryType === 'construccion') {
      multiplier *= 3.0;
      explanations.push(
        'El cliente pertenece al sector construcción, donde esta exclusión aplica directamente.'
      );
    }

    mitigations.push('Contratar seguro de responsabilidad civil de construcción');
  }

  if (exclusionLower.includes('proveedor') || exclusionLower.includes('cadena de suministro')) {
    if (profile.hasSingleSupplier) {
      multiplier *= 3.0;
      explanations.push(
        'El cliente depende de un único proveedor, haciendo esta exclusión crítica.'
      );
      mitigations.push('Diversificar proveedores');
      mitigations.push('Contratar cobertura de interrupción de negocio');
    }
  }

  // Determine final risk level
  let contextualRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  if (baseRiskLevel === 'HIGH' && multiplier >= 2.5) {
    contextualRiskLevel = 'CRITICAL';
  } else if (baseRiskLevel === 'HIGH' && multiplier >= 1.5) {
    contextualRiskLevel = 'HIGH';
  } else if (multiplier >= 2.0) {
    contextualRiskLevel = 'HIGH';
  } else if (baseRiskLevel === 'MEDIUM' && multiplier > 1.0) {
    contextualRiskLevel = 'MEDIUM';
  } else {
    contextualRiskLevel = 'LOW';
  }

  // Build explanation
  const explanation =
    explanations.length > 0
      ? explanations.join(' ')
      : `Exclusión estándar. Impacto limitado para el perfil del cliente (${profile.industryType}, ${profile.locationZone}).`;

  // Default mitigations if none specific
  if (mitigations.length === 0) {
    mitigations.push('Verificar si la exclusión es negociable');
    mitigations.push('Evaluar coberturas adicionales disponibles');
  }

  return {
    exclusion,
    baseRiskLevel,
    contextualRiskLevel,
    explanation,
    mitigationSuggestions: mitigations,
    estimatedAdditionalCost: estimatedCost,
  };
}

export default contextualRiskAnalyzer;
