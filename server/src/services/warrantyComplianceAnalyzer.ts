/**
 * Warranty Compliance Analyzer
 * Analyzes warranty/compliance conditions by type and difficulty
 * Calculates compliance risk based on client profile
 */

import { ClientProfile } from './contextualRiskAnalyzer';

export type WarrantyType = 'DOCUMENTAL' | 'OPERACIONAL' | 'TECNICO' | 'FINANCIERO';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';
export type ComplianceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface WarrantyCondition {
  text: string;
  type: WarrantyType;
  difficulty: DifficultyLevel;
  complianceRisk: ComplianceRiskLevel;
  verificationMethod: string;
  estimatedCost?: number;
}

export interface WarrantyComplianceSummary {
  totalConditions: number;
  byType: {
    documental: { count: number; compliant: number; risk: ComplianceRiskLevel };
    operacional: { count: number; compliant: number; risk: ComplianceRiskLevel };
    tecnico: { count: number; compliant: number; risk: ComplianceRiskLevel };
    financiero: { count: number; compliant: number; risk: ComplianceRiskLevel };
  };
  overallRisk: ComplianceRiskLevel;
  highRiskConditions: WarrantyCondition[];
  compliancePercentage: number;
}

// Keywords for classification
const TYPE_KEYWORDS: Record<WarrantyType, string[]> = {
  'DOCUMENTAL': [
    'certificado', 'documento', 'póliza', 'declaración', 'formulario',
    'registro', 'licencia', 'permiso', 'constancia'
  ],
  'OPERACIONAL': [
    'procedimiento', 'protocolo', 'manual', 'capacitación', 'inspección',
    'mantenimiento', 'alarma', 'vigilancia', 'control'
  ],
  'TECNICO': [
    'sistema', 'equipo', 'instalación', 'prueba', 'medición',
    'verificación', 'calibración', 'detector', 'extintor'
  ],
  'FINANCIERO': [
    'fianza', 'garantía', 'depósito', 'pago', 'prima',
    'cobro', 'reembolso', 'deducible', 'franquicia'
  ]
};

const DIFFICULTY_INDICATORS: Record<DifficultyLevel, string[]> = {
  'EASY': ['presentar', 'tener', 'contar con', 'disponer'],
  'MEDIUM': ['mantener', 'realizar', 'efectuar', 'ejecutar'],
  'HARD': ['constituir', 'establecer', 'implementar', 'certificar']
};

export const warrantyComplianceAnalyzer = {
  /**
   * Analyze warranty conditions from clause text
   */
  analyzeConditions: (
    conditions: string[],
    clientProfile?: ClientProfile
  ): WarrantyComplianceSummary => {
    console.log(`🔍 [warrantyComplianceAnalyzer] Analyzing ${conditions.length} conditions...`);
    
    const analyzedConditions = conditions.map(condition =>
      analyzeSingleCondition(condition, clientProfile)
    );
    
    // Group by type
    const byType = {
      documental: aggregateType(analyzedConditions, 'DOCUMENTAL'),
      operacional: aggregateType(analyzedConditions, 'OPERACIONAL'),
      tecnico: aggregateType(analyzedConditions, 'TECNICO'),
      financiero: aggregateType(analyzedConditions, 'FINANCIERO')
    };
    
    // Calculate overall risk
    const highRiskCount = analyzedConditions.filter(c => c.complianceRisk === 'HIGH').length;
    const mediumRiskCount = analyzedConditions.filter(c => c.complianceRisk === 'MEDIUM').length;
    const totalCount = analyzedConditions.length;
    
    let overallRisk: ComplianceRiskLevel;
    if (highRiskCount / totalCount > 0.3) {
      overallRisk = 'HIGH';
    } else if (mediumRiskCount / totalCount > 0.3 || highRiskCount > 0) {
      overallRisk = 'MEDIUM';
    } else {
      overallRisk = 'LOW';
    }
    
    // Calculate compliance percentage (simulated)
    const easyCompliant = analyzedConditions.filter(c => 
      c.difficulty === 'EASY' && c.type !== 'FINANCIERO'
    ).length;
    const compliancePercentage = totalCount > 0 
      ? Math.round((easyCompliant / totalCount) * 100)
      : 0;
    
    console.log(`✅ [warrantyComplianceAnalyzer] Overall risk: ${overallRisk}, Compliance: ${compliancePercentage}%`);
    
    return {
      totalConditions: totalCount,
      byType,
      overallRisk,
      highRiskConditions: analyzedConditions.filter(c => c.complianceRisk === 'HIGH'),
      compliancePercentage
    };
  },
  
  /**
   * Classify a single condition
   */
  classifyCondition: (conditionText: string): WarrantyType => {
    const lowerText = conditionText.toLowerCase();
    
    let bestMatch: WarrantyType = 'OPERACIONAL';
    let maxMatches = 0;
    
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      const matches = keywords.filter(k => lowerText.includes(k)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = type as WarrantyType;
      }
    }
    
    return bestMatch;
  }
};

function analyzeSingleCondition(
  condition: string,
  clientProfile?: ClientProfile
): WarrantyCondition {
  const type = warrantyComplianceAnalyzer.classifyCondition(condition);
  
  // Determine difficulty
  let difficulty: DifficultyLevel = 'MEDIUM';
  const lowerCondition = condition.toLowerCase();
  
  for (const [level, indicators] of Object.entries(DIFFICULTY_INDICATORS)) {
    if (indicators.some(i => lowerCondition.includes(i))) {
      difficulty = level as DifficultyLevel;
      break;
    }
  }
  
  // Adjust difficulty based on client profile
  if (clientProfile) {
    if (type === 'FINANCIERO' && clientProfile.annualRevenue < 100000000) {
      difficulty = 'HARD'; // Financial conditions are harder for small businesses
    }
    
    if (type === 'TECNICO' && clientProfile.employeeCount < 10) {
      difficulty = 'HARD'; // Technical conditions harder for small teams
    }
  }
  
  // Determine compliance risk
  let complianceRisk: ComplianceRiskLevel;
  
  if (type === 'FINANCIERO' && difficulty === 'HARD') {
    complianceRisk = 'HIGH';
  } else if (difficulty === 'HARD') {
    complianceRisk = 'MEDIUM';
  } else if (difficulty === 'MEDIUM') {
    complianceRisk = 'MEDIUM';
  } else {
    complianceRisk = 'LOW';
  }
  
  // Determine verification method
  let verificationMethod: string;
  switch (type) {
    case 'DOCUMENTAL':
      verificationMethod = 'Revisión documental';
      break;
    case 'OPERACIONAL':
      verificationMethod = 'Inspección in situ';
      break;
    case 'TECNICO':
      verificationMethod = 'Pruebas técnicas';
      break;
    case 'FINANCIERO':
      verificationMethod = 'Verificación bancaria';
      break;
  }
  
  // Estimate cost
  let estimatedCost: number | undefined;
  if (type === 'FINANCIERO') {
    estimatedCost = 5000000; // $5M COP placeholder
  } else if (type === 'TECNICO' && difficulty === 'HARD') {
    estimatedCost = 2000000; // $2M COP
  }
  
  return {
    text: condition,
    type,
    difficulty,
    complianceRisk,
    verificationMethod,
    estimatedCost
  };
}

function aggregateType(
  conditions: WarrantyCondition[],
  type: WarrantyType
) {
  const typeConditions = conditions.filter(c => c.type === type);
  const compliant = typeConditions.filter(c => c.difficulty === 'EASY').length;
  
  // Calculate type risk
  const highRiskCount = typeConditions.filter(c => c.complianceRisk === 'HIGH').length;
  let risk: ComplianceRiskLevel;
  
  if (highRiskCount / (typeConditions.length || 1) > 0.5) {
    risk = 'HIGH';
  } else if (highRiskCount > 0) {
    risk = 'MEDIUM';
  } else {
    risk = 'LOW';
  }
  
  return {
    count: typeConditions.length,
    compliant,
    risk
  };
}

export default warrantyComplianceAnalyzer;
