/**
 * Debug script for confidence scoring
 * Shows detailed breakdown of how confidence scores are calculated for each quote
 * 
 * Usage:
 *   GEMINI_API_KEY=your_key npx tsx debug-confidence.ts
 */

import { pdfExtractor } from './src/services/pdfExtractor';
import { geminiService } from './src/services/gemini';
import { preprocessText } from './src/services/textPreprocessor';
import { parseJsonWithRepair } from './src/services/jsonRepair';
import { mapCoverageName, normalizeDeductible, loadThesaurus } from './src/services/thesaurusMapper';
import { validateQuote, ValidationResult } from './src/services/quoteValidator';
import { calculateConfidence, getConfidenceLabel, ConfidenceBreakdown } from './src/services/confidenceScorer';
import { ParsedQuote } from './src/services/quoteParser';
import fs from 'fs';
import path from 'path';

const QUOTES_DIR = path.join(process.cwd(), '..', '..', 'Ejemplos', 'laser-home');

// Replicate the internal scoring functions with detailed logging
function debugCoverageCompleteness(quote: ParsedQuote, label: string): { score: number; details: string } {
  let details = '';
  
  if ((quote as any).expectedCoverages && Array.isArray((quote as any).expectedCoverages)) {
    const expectedCoverages = (quote as any).expectedCoverages;
    const expectedCount = expectedCoverages.length;
    const presentCount = expectedCoverages.filter((c: any) => c.status === 'present').length;
    const missingCount = expectedCoverages.filter((c: any) => c.status === 'missing').length;
    const excludedCount = expectedCoverages.filter((c: any) => c.status === 'excluded').length;
    
    details += `  Using expectedCoverages array (${expectedCount} total)\n`;
    details += `  - present: ${presentCount}, missing: ${missingCount}, excluded: ${excludedCount}\n`;
    
    if (expectedCount === 0) {
      details += `  → expectedCount is 0, returning 0\n`;
      return { score: 0, details };
    }
    
    const realisticTarget = 8;
    if (presentCount >= realisticTarget) {
      details += `  → presentCount (${presentCount}) >= realisticTarget (${realisticTarget}), score = 100\n`;
      return { score: 100, details };
    }
    const score = Math.min(100, (presentCount / realisticTarget) * 100);
    details += `  → Score = min(100, (${presentCount} / ${realisticTarget}) * 100) = ${score.toFixed(2)}\n`;
    return { score, details };
  }
  
  // Fallback to legacy calculation
  if (!quote.coverages || quote.coverages.length === 0) {
    details += `  No coverages found, returning 0\n`;
    return { score: 0, details };
  }
  
  const realisticTarget = 8;
  const presentCount = quote.coverages.filter(c => 
    c.value && c.value !== 'NO ESPECIFICADO' && c.value !== 'EXCLUIDO'
  ).length;
  
  details += `  Using legacy coverages array (${quote.coverages.length} total)\n`;
  details += `  - coverages with valid values: ${presentCount}\n`;
  
  if (presentCount >= realisticTarget) {
    details += `  → presentCount (${presentCount}) >= realisticTarget (${realisticTarget}), score = 100\n`;
    return { score: 100, details };
  }
  const score = Math.min(100, (presentCount / realisticTarget) * 100);
  details += `  → Score = min(100, (${presentCount} / ${realisticTarget}) * 100) = ${score.toFixed(2)}\n`;
  return { score, details };
}

function debugNumericParseSuccess(quote: ParsedQuote, label: string): { score: number; details: string } {
  let details = '';
  
  if (!quote.coverages || quote.coverages.length === 0) {
    details += `  No coverages found, returning 0\n`;
    return { score: 0, details };
  }
  
  let totalNumericFields = 0;
  let successfulParses = 0;
  
  // Check premium
  if (quote.priceAnnual > 0) {
    totalNumericFields++;
    successfulParses++;
    details += `  Premium: ${quote.priceAnnual} ✅ (parse success)\n`;
  } else {
    totalNumericFields++;
    details += `  Premium: ${quote.priceAnnual} ❌ (parse failed or zero)\n`;
  }
  
  // Check coverage values
  details += `  Coverage values:\n`;
  for (const coverage of quote.coverages) {
    if (coverage.value && coverage.value !== 'NO ESPECIFICADO' && coverage.value !== 'EXCLUIDO') {
      totalNumericFields++;
      const cleaned = coverage.value.replace(/[\$\s.,]/g, '');
      if (!isNaN(parseFloat(cleaned)) && cleaned !== '') {
        successfulParses++;
        details += `    "${coverage.name}": "${coverage.value}" → ${parseFloat(cleaned)} ✅\n`;
      } else {
        details += `    "${coverage.name}": "${coverage.value}" → cleaned="${cleaned}" ❌ (not numeric)\n`;
      }
    } else {
      details += `    "${coverage.name}": "${coverage.value}" → skipped (not a numeric field)\n`;
    }
  }
  
  if (totalNumericFields === 0) {
    details += `  → totalNumericFields is 0, returning 0\n`;
    return { score: 0, details };
  }
  const score = (successfulParses / totalNumericFields) * 100;
  details += `  → ${successfulParses}/${totalNumericFields} successful = ${score.toFixed(2)}\n`;
  return { score, details };
}

function debugValidationPassRate(validation: ValidationResult, label: string): { score: number; details: string } {
  let details = '';
  const totalChecks = 6;
  let passedChecks = 0;
  
  details += `  Validation checks (6 total):\n`;
  
  // Check 1: Coverage completeness
  const check1 = validation.coverageCount >= 5;
  if (check1) passedChecks++;
  details += `    1. coverageCount >= 5: ${validation.coverageCount} ${check1 ? '✅' : '❌'}\n`;
  
  // Check 2: No critical errors
  const criticalCount = validation.flags.filter(f => f.severity === 'CRITICAL').length;
  const check2 = criticalCount === 0;
  if (check2) passedChecks++;
  details += `    2. No critical errors: ${criticalCount} critical ${check2 ? '✅' : '❌'}\n`;
  
  // Check 3: Numeric parse success
  const check3 = validation.numericParseSuccess;
  if (check3) passedChecks++;
  details += `    3. numericParseSuccess: ${validation.numericParseSuccess} ${check3 ? '✅' : '❌'}\n`;
  
  // Check 4: Premium exists
  const hasPremium = !validation.flags.some(f => f.code === 'PREMIUM_MISSING');
  const check4 = hasPremium;
  if (check4) passedChecks++;
  details += `    4. Premium exists: ${hasPremium} ${check4 ? '✅' : '❌'}\n`;
  
  // Check 5: Deductible formats valid
  const hasDeductibleErrors = validation.flags.some(f => f.code === 'DEDUCTIBLE_UNRECOGNIZED_FORMAT');
  const check5 = !hasDeductibleErrors;
  if (check5) passedChecks++;
  details += `    5. No deductible errors: ${!hasDeductibleErrors} ${check5 ? '✅' : '❌'}\n`;
  
  // Check 6: Less than 3 warnings
  const warningCount = validation.flags.filter(f => f.severity === 'WARNING').length;
  const check6 = warningCount < 3;
  if (check6) passedChecks++;
  details += `    6. Warnings < 3: ${warningCount} warnings ${check6 ? '✅' : '❌'}\n`;
  
  const score = (passedChecks / totalChecks) * 100;
  details += `  → ${passedChecks}/${totalChecks} passed = ${score.toFixed(2)}\n`;
  return { score, details };
}

function debugSchemaCompliance(quote: ParsedQuote, label: string): { score: number; details: string } {
  let details = '';
  let score = 0;
  
  details += `  Schema compliance checks:\n`;
  
  if (quote.insurerName && quote.insurerName !== 'NO ESPECIFICADO') {
    score += 25;
    details += `    insurerName: "${quote.insurerName}" → +25 ✅\n`;
  } else {
    details += `    insurerName: "${quote.insurerName}" → +0 ❌\n`;
  }
  
  if (quote.policyName && quote.policyName !== 'NO ESPECIFICADO') {
    score += 25;
    details += `    policyName: "${quote.policyName}" → +25 ✅\n`;
  } else {
    details += `    policyName: "${quote.policyName}" → +0 ❌\n`;
  }
  
  if (quote.priceAnnual > 0) {
    score += 25;
    details += `    priceAnnual: ${quote.priceAnnual} → +25 ✅\n`;
  } else {
    details += `    priceAnnual: ${quote.priceAnnual} → +0 ❌\n`;
  }
  
  if (quote.coverages && quote.coverages.length > 0) {
    score += 25;
    details += `    coverages: ${quote.coverages.length} → +25 ✅\n`;
  } else {
    details += `    coverages: ${quote.coverages?.length || 0} → +0 ❌\n`;
  }
  
  details += `  → Raw score = ${score}\n`;
  return { score, details };
}

function printConfidenceBreakdown(
  quote: ParsedQuote,
  validation: ValidationResult,
  isStructured: boolean = false
) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 CONFIDENCE SCORE BREAKDOWN`);
  console.log(`${'='.repeat(70)}`);
  
  const weights = {
    coverageCompleteness: 0.30,
    numericParseSuccess: 0.25,
    validationPassRate: 0.25,
    schemaCompliance: 0.20,
  };
  
  // Calculate each component with debug info
  const covResult = debugCoverageCompleteness(quote, 'Coverage Completeness');
  const numResult = debugNumericParseSuccess(quote, 'Numeric Parse Success');
  const valResult = debugValidationPassRate(validation, 'Validation Pass Rate');
  const schResult = debugSchemaCompliance(quote, 'Schema Compliance');
  
  console.log(`\n1️⃣  COVERAGE COMPLETENESS (weight: ${weights.coverageCompleteness})`);
  console.log(covResult.details);
  
  console.log(`\n2️⃣  NUMERIC PARSE SUCCESS (weight: ${weights.numericParseSuccess})`);
  console.log(numResult.details);
  
  console.log(`\n3️⃣  VALIDATION PASS RATE (weight: ${weights.validationPassRate})`);
  console.log(valResult.details);
  
  console.log(`\n4️⃣  SCHEMA COMPLIANCE (weight: ${weights.schemaCompliance})`);
  let schemaScore = schResult.score;
  console.log(schResult.details);
  
  if (isStructured) {
    const bonusScore = Math.min(100, schemaScore * 1.2);
    console.log(`  Structured extraction bonus: ${schemaScore} × 1.2 = ${bonusScore.toFixed(2)} (capped at 100)`);
    schemaScore = bonusScore;
  }
  
  // Calculate weighted score
  let weightedScore = 
    covResult.score * weights.coverageCompleteness +
    numResult.score * weights.numericParseSuccess +
    valResult.score * weights.validationPassRate +
    schemaScore * weights.schemaCompliance;
  
  console.log(`\n📐 WEIGHTED CALCULATION:`);
  console.log(`  Coverage:     ${covResult.score.toFixed(2)} × ${weights.coverageCompleteness} = ${(covResult.score * weights.coverageCompleteness).toFixed(2)}`);
  console.log(`  Numeric:      ${numResult.score.toFixed(2)} × ${weights.numericParseSuccess} = ${(numResult.score * weights.numericParseSuccess).toFixed(2)}`);
  console.log(`  Validation:   ${valResult.score.toFixed(2)} × ${weights.validationPassRate} = ${(valResult.score * weights.validationPassRate).toFixed(2)}`);
  console.log(`  Schema:       ${schemaScore.toFixed(2)} × ${weights.schemaCompliance} = ${(schemaScore * weights.schemaCompliance).toFixed(2)}`);
  console.log(`  ───────────────────────────────────────`);
  console.log(`  Subtotal:     ${weightedScore.toFixed(2)}`);
  
  // Penalties
  const hasPremiumIssue = validation.flags.some(f => 
    f.code === 'PREMIUM_MISSING' || f.code === 'PREMIUM_SUSPECT'
  );
  
  if (hasPremiumIssue) {
    console.log(`\n⚠️  PENALTY APPLIED:`);
    console.log(`  Premium issue detected (${validation.flags.find(f => f.code === 'PREMIUM_MISSING' || f.code === 'PREMIUM_SUSPECT')?.code})`);
    console.log(`  Score: ${weightedScore.toFixed(2)} - 25 = ${(weightedScore - 25).toFixed(2)}`);
    weightedScore -= 25;
  } else {
    console.log(`\n✅ No penalties applied`);
  }
  
  // Final score
  const finalScore = Math.max(0, Math.min(100, Math.round(weightedScore)));
  
  console.log(`\n🏆 FINAL SCORE:`);
  console.log(`  Clamped to [0, 100]: ${finalScore}/100`);
  console.log(`  Label: ${getConfidenceLabel(finalScore)}`);
  console.log(`  Needs Review: ${finalScore < 75 ? 'YES ⚠️' : 'No ✅'}`);
  console.log(`  Is Critical: ${finalScore < 50 ? 'YES 🚨' : 'No ✅'}`);
  
  return finalScore;
}

async function debugQuote(pdfPath: string, insurerName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 DEBUG CONFIDENCE: ${insurerName}`);
  console.log(`📄 ${path.basename(pdfPath)}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // === STAGE 1: PDF EXTRACTION ===
    console.log('📄 STAGE 1: PDF Text Extraction');
    console.log('-'.repeat(50));
    const extraction = await pdfExtractor.extractTextFromPdf(pdfPath);
    console.log(`✅ Extracted ${extraction.text.length} chars from ${extraction.metadata.pageCount} pages\n`);

    // === STAGE 2: PRE-PROCESSING ===
    console.log('🧹 STAGE 2: Text Pre-processing');
    console.log('-'.repeat(50));
    const preprocessed = preprocessText(
      extraction.text,
      extraction.metadata.pageCount,
      {
        normalizeNumbers: true,
        fixEncoding: true,
        removeArtifacts: true,
        extractSections: extraction.metadata.pageCount > 10,
      }
    );
    console.log(`✅ Pre-processing complete`);
    console.log(`   Size: ${preprocessed.metadata.originalLength} → ${preprocessed.metadata.cleanedLength} chars\n`);

    // === STAGE 3: GEMINI STRUCTURED EXTRACTION ===
    console.log(`🤖 STAGE 3: Gemini Structured Extraction`);
    console.log('-'.repeat(50));
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️  GEMINI_API_KEY not set. Skipping AI extraction.\n');
      return;
    }

    const prompt = `Eres un extractor de datos de cotizaciones de seguros PYME. Extrae la información EXACTAMENTE como aparece en el documento.

REGLAS CRÍTICAS:
1. Extrae el nombre de cada cobertura EXACTAMENTE como aparece en el PDF (no lo traduzcas ni modifiques)
2. Extrae el valor asegurado tal cual aparece
3. Extrae el deducible EXACTAMENTE como aparece en el documento (incluyendo "APLICA", "NO APLICA", porcentajes, etc.)
4. Busca en tablas de coberturas, usualmente tienen columnas: Cobertura / Suma Asegurada / Deducible
5. Si una cobertura no aparece, NO la incluyas en el array de coverages

IMPORTANTE - FORMATO DE RESPUESTA:
- Devuelve SOLO JSON válido, sin bloques de código markdown (sin backticks json)
- NO trunques la respuesta. Debes completar TODO el JSON
- Si hay muchas coberturas, asegúrate de incluir TODAS
- El array "coverages" debe contener SOLO las coberturas que encontraste en el documento
- El array "expectedCoverages" debe contener las 14 coberturas PYME estándar con su estado (present/missing/excluded)
- Copia los nombres exactos del PDF, no uses nombres genéricos
- Los deducibles pueden ser: porcentajes ("10%"), montos fijos ("5 SMMLV"), o textos ("NO APLICA", "APLICA")`;

    let geminiResult;
    try {
      geminiResult = await geminiService.extractStructured(
        preprocessed.text,
        prompt,
        extraction.metadata.pageCount
      );

      if (!geminiResult.coverages || geminiResult.coverages.length === 0) {
        console.log(`   ⚠️  Structured extraction returned 0 coverages. Trying text-based extraction...`);
        const textResult = await geminiService.extractText(preprocessed.text, prompt);
        
        const repaired = parseJsonWithRepair(textResult);
        if (repaired.success && repaired.data.coverages && repaired.data.coverages.length > 0) {
          console.log(`   ✅ Text extraction found ${repaired.data.coverages.length} coverages!`);
          geminiResult = repaired.data;
        }
      }

      console.log(`✅ Gemini extraction successful`);
      console.log(`   Aseguradora: ${geminiResult.insurerName}`);
      console.log(`   Póliza: ${geminiResult.policyName}`);
      console.log(`   Prima: ${geminiResult.priceAnnual?.toLocaleString('es-CO')} ${geminiResult.currency}`);
      console.log(`   Coberturas: ${geminiResult.coverages?.length || 0}`);

    } catch (geminiError: any) {
      console.log(`❌ Gemini extraction failed: ${geminiError.message}`);
      return;
    }

    // === STAGE 4: THESAURUS NORMALIZATION ===
    console.log(`\n📚 STAGE 4: Thesaurus Normalization`);
    console.log('-'.repeat(50));

    const thesaurus = loadThesaurus();
    console.log(`✅ Thesaurus loaded: ${thesaurus.length} canonical terms`);

    if (geminiResult.coverages && geminiResult.coverages.length > 0) {
      let normalizedCoverages = geminiResult.coverages.map((cov: any) => {
        const mapping = mapCoverageName(cov.name);
        const deductibleNorm = normalizeDeductible(cov.deductible || '');
        
        return {
          originalName: cov.name,
          canonicalName: mapping.canonicalName,
          value: cov.value,
          deductible: deductibleNorm.normalized,
          confidence: mapping.confidence,
          needsReview: mapping.needsReview || deductibleNorm.needsReview,
        };
      });

      // Remove duplicates
      const seen = new Map();
      normalizedCoverages.forEach((cov: any) => {
        const existing = seen.get(cov.canonicalName);
        if (!existing || cov.confidence > existing.confidence) {
          seen.set(cov.canonicalName, cov);
        }
      });
      normalizedCoverages = Array.from(seen.values());

      // Filter low confidence
      normalizedCoverages = normalizedCoverages.filter((cov: any) => cov.confidence >= 0.3);

      console.log(`✅ Normalized ${normalizedCoverages.length} coverages`);
      
      geminiResult.coverages = normalizedCoverages.map((c: any) => ({
        name: c.canonicalName,
        value: c.value,
        deductible: c.deductible,
        originalName: c.originalName,
        confidence: c.confidence,
      }));
    }

    // === STAGE 5: VALIDATION ===
    console.log(`\n✅ STAGE 5: Validation`);
    console.log('-'.repeat(50));

    const validation = validateQuote(geminiResult);
    
    console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`   Coverages: ${validation.coverageCount}/${validation.expectedCoverageCount}`);
    console.log(`   Flags: ${validation.flags.length}`);
    if (validation.flags.length > 0) {
      validation.flags.forEach((f: any) => {
        console.log(`     - [${f.severity}] ${f.code}: ${f.message}`);
      });
    }

    // === DETAILED CONFIDENCE BREAKDOWN ===
    const finalScore = printConfidenceBreakdown(geminiResult, validation, true);

    // Save detailed results
    const outputPath = pdfPath.replace('.pdf', '_confidence_debug.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      insurerName,
      geminiResult: {
        insurerName: geminiResult.insurerName,
        policyName: geminiResult.policyName,
        priceAnnual: geminiResult.priceAnnual,
        currency: geminiResult.currency,
        coverageCount: geminiResult.coverages?.length || 0,
      },
      validation: {
        isValid: validation.isValid,
        coverageCount: validation.coverageCount,
        flags: validation.flags,
      },
      confidenceScore: finalScore,
    }, null, 2));
    console.log(`\n💾 Debug results saved to: ${path.basename(outputPath)}`);

  } catch (error: any) {
    console.error(`\n❌ Debug failed:`, error.message);
  }
}

async function main() {
  console.log('\n🚀 Confidence Score Debug Script');
  console.log('   Shows detailed breakdown of confidence calculations\n');

  console.log('Prerequisites:');
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log();

  const testQuotes = [
    { file: 'Cotización - MAPFRE.pdf', name: 'MAPFRE' },
    { file: 'Cotización - CHUBB.pdf', name: 'CHUBB' },
    { file: 'Cotización - BBVA.pdf', name: 'BBVA' },
    { file: 'Cotización - AXA Colpatria.pdf', name: 'AXA Colpatria' },
  ];

  for (const quote of testQuotes) {
    const pdfPath = path.join(QUOTES_DIR, quote.file);
    if (fs.existsSync(pdfPath)) {
      await debugQuote(pdfPath, quote.name);
    } else {
      console.log(`\n⚠️  Skipping ${quote.name}: file not found`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Debug complete!');
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
