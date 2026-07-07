/**
 * End-to-End Test Script
 * Tests the complete pipeline with mock data
 *
 * Usage: npx ts-node server/src/services/__tests__/e2e/complete-analysis.e2e.ts
 */

import { clauseCoverageValidator } from '../../clauseCoverageValidator';
import { deductibleAnalyzer } from '../../deductibleAnalyzer';
import { inverseCoverageChecker } from '../../inverseCoverageChecker';
import { contextualRiskAnalyzer } from '../../contextualRiskAnalyzer';
import { warrantyComplianceAnalyzer } from '../../warrantyComplianceAnalyzer';
import { virtualLawyerService } from '../../virtualLawyerService';
import { quoteScorer } from '../../quoteScorer';

// Mock data for E2E test
const e2eQuote = {
  insurerName: 'Seguros Bolívar',
  policyName: 'Empresarial Plus',
  priceAnnual: 8500000,
  currency: 'COP',
  coverages: [
    {
      name: 'Incendio (Edificio y Contenidos)',
      canonicalName: 'Incendio (Edificio y Contenidos)',
      value: '500000000',
      deductible: '10%',
    },
    {
      name: 'Responsabilidad Civil (RCE)',
      canonicalName: 'Responsabilidad Civil (RCE)',
      value: '100000000',
      deductible: '5 SMMLV',
    },
    {
      name: 'Lucro Cesante',
      canonicalName: 'Lucro Cesante',
      value: '100000000',
      deductible: 'No aplica',
    },
    {
      name: 'Cobertura Fantasma',
      canonicalName: 'Cobertura Fantasma',
      value: '1000000',
      deductible: '10%',
    },
  ],
  specialConditions: [],
  rawText: 'E2E Test Quote',
  parseConfidence: 95,
};

const e2eClientProfile = {
  industryType: 'manufactura' as const,
  locationCity: 'Cartagena',
  locationZone: 'costera' as const,
  hasSingleSupplier: true,
  employeeCount: 150,
  buildingType: 'propio' as const,
  primaryActivity: 'Fabricación de alimentos',
  annualRevenue: 2000000000,
};

const e2eExclusions = [
  'No cubre inundación en zonas costeras',
  'No cubre falla de proveedor único',
];

const e2eConditions = [
  'Presentar certificado de bomberos vigente',
  'Mantener sistema de alarma conectado 24/7',
  'Constituir fianza de cumplimiento del 20%',
];

async function runE2ETest() {
  console.log('🚀 Starting End-to-End Test...\n');

  try {
    // Phase 1: Coverage Validation
    console.log('📋 Phase 1: Coverage Validation');
    const validation = await clauseCoverageValidator.validate(e2eQuote, e2eQuote.insurerName);
    console.log(
      `   ✅ Coverage validation: ${validation.verifiedCount} verified, ${validation.phantomCount} phantom`
    );

    // Phase 2: Deductible Analysis
    console.log('\n💰 Phase 2: Deductible Risk Analysis');
    const deductibleAnalysis = deductibleAnalyzer.analyze(
      'Incendio',
      '10%',
      '10% / Máx. 500 SMMLV',
      500000000
    );
    console.log(
      `   ✅ Deductible risk: ${deductibleAnalysis.riskLevel} (${deductibleAnalysis.score}/100)`
    );

    // Phase 2: Inverse Coverage Check
    console.log('\n🔍 Phase 2: Inverse Coverage Check');
    const inverseCheck = await inverseCoverageChecker.checkMissingCoverages(
      e2eQuote,
      e2eQuote.insurerName
    );
    console.log(
      `   ✅ Missing coverages: ${inverseCheck.mandatoryMissingCount} mandatory, ${inverseCheck.optionalMissingCount} optional`
    );

    // Phase 3: Contextual Risk Analysis
    console.log('\n🌍 Phase 3: Contextual Risk Analysis');
    const contextualRisk = contextualRiskAnalyzer.contextualizeExclusions(
      e2eExclusions,
      e2eClientProfile
    );
    console.log(
      `   ✅ Contextual analysis: ${contextualRisk.criticalCount} critical, ${contextualRisk.highCount} high`
    );

    // Phase 3: Warranty Compliance
    console.log('\n📊 Phase 3: Warranty Compliance Analysis');
    const warrantyCompliance = warrantyComplianceAnalyzer.analyzeConditions(
      e2eConditions,
      e2eClientProfile
    );
    console.log(
      `   ✅ Compliance: ${warrantyCompliance.compliancePercentage}%, Overall risk: ${warrantyCompliance.overallRisk}`
    );

    // Phase 4: Legal Opinion (mock)
    console.log('\n⚖️  Phase 4: Legal Opinion Generation');
    const legalOpinion = await virtualLawyerService.generateLegalOpinion(
      {
        insurerName: e2eQuote.insurerName,
        coverageName: 'Responsabilidad Civil',
        value: '100M',
        deductible: '5 SMMLV',
        exclusions: [],
      },
      e2eClientProfile,
      e2eQuote.insurerName
    );
    console.log(
      `   ✅ Legal opinion: ${legalOpinion.confidence}% confidence, ${legalOpinion.negotiationPoints.length} negotiation points`
    );

    // Scoring Test
    console.log('\n📊 Scoring Test');
    const clauseValidation = validation.results;
    const score = quoteScorer.calculateScore(e2eQuote, [], [e2eQuote], undefined, clauseValidation);
    console.log(`   ✅ Total score: ${score.totalScore}/100`);
    console.log(`   Breakdown:`, score.breakdown);

    console.log('\n✨ E2E Test Completed Successfully!\n');

    return {
      success: true,
      phases: {
        coverageValidation: validation,
        deductibleAnalysis,
        inverseCheck,
        contextualRisk,
        warrantyCompliance,
        legalOpinion,
        scoring: score,
      },
    };
  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error);
    return { success: false, error };
  }
}

// Run if executed directly
if (require.main === module) {
  runE2ETest().then((result) => {
    process.exit(result.success ? 0 : 1);
  });
}

export { runE2ETest };
