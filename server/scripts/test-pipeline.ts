/**
 * End-to-end pipeline test script
 * Tests full flow: PDF → Preprocessing → Gemini → Thesaurus → Validation
 * 
 * Usage:
 *   export GEMINI_API_KEY=your_key_here
 *   npx ts-node scripts/test-pipeline.ts
 */

import { pdfExtractor } from '../src/services/pdfExtractor';
import { geminiService } from '../src/services/gemini';
import { preprocessText } from '../src/services/textPreprocessor';
import { parseJsonWithRepair } from '../src/services/jsonRepair';
import { mapCoverageName, normalizeDeductible, loadThesaurus } from '../src/services/thesaurusMapper';
import { validateQuote } from '../src/services/quoteValidator';
import { calculateConfidence, getConfidenceLabel } from '../src/services/confidenceScorer';
import { formatPercentage } from '../src/utils/formatCurrency';
import { QuoteExtraction } from '../src/schemas/extractionSchemas';
import fs from 'fs';
import path from 'path';

interface PipelineResult {
  insurerName: string;
  stages: Record<string, Record<string, unknown>>;
  validations: Record<string, Record<string, unknown>>;
  error?: string;
}

const QUOTES_DIR = path.join(process.cwd(), '..', '..', 'Ejemplos', 'laser-home');

async function testPipeline(pdfPath: string, insurerName: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 PIPELINE TEST: ${insurerName}`);
  console.log(`📄 ${path.basename(pdfPath)}`);
  console.log(`${'='.repeat(70)}\n`);

  const pipelineResults: PipelineResult = {
    insurerName,
    stages: {},
    validations: {},
  };

  try {
    // === STAGE 1: PDF EXTRACTION ===
    console.log('📄 STAGE 1: PDF Text Extraction');
    console.log('-'.repeat(50));
    const extraction = await pdfExtractor.extractTextFromPdf(pdfPath);
    
    pipelineResults.stages.extraction = {
      success: true,
      chars: extraction.text.length,
      pages: extraction.metadata.pageCount,
      warnings: extraction.warnings.length,
    };

    console.log(`✅ Extracted ${extraction.text.length} chars from ${extraction.metadata.pageCount} pages`);
    console.log(`   Warnings: ${extraction.warnings.length}`);
    console.log(`   Preview: "${extraction.text.substring(0, 150)}..."\n`);

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

    pipelineResults.stages.preprocessing = {
      success: true,
      originalLength: preprocessed.metadata.originalLength,
      cleanedLength: preprocessed.metadata.cleanedLength,
      complexity: preprocessed.metadata.complexity,
      changes: preprocessed.metadata.changes,
    };

    console.log(`✅ Pre-processing complete`);
    console.log(`   Complexity: ${preprocessed.metadata.complexity}`);
    console.log(`   Changes: ${preprocessed.metadata.changes.join(', ') || 'None'}`);
    console.log(`   Size: ${preprocessed.metadata.originalLength} → ${preprocessed.metadata.cleanedLength} chars`);
    console.log(`   Preview: "${preprocessed.text.substring(0, 150)}..."\n`);

    // Check for Colombian numbers before/after
    const hasColombianBefore = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/.test(extraction.text);
    const hasColombianAfter = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/.test(preprocessed.text);
    console.log(`   Colombian format: ${hasColombianBefore ? 'Present' : 'Not found'} → ${hasColombianAfter ? 'Still present' : 'Normalized'}`);

    // === STAGE 3: GEMINI STRUCTURED EXTRACTION ===
    console.log(`\n🤖 STAGE 3: Gemini Structured Extraction`);
    console.log('-'.repeat(50));
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️  GEMINI_API_KEY not set. Skipping AI extraction.');
      console.log('   Set it with: export GEMINI_API_KEY=your_key_here\n');
      pipelineResults.stages.gemini = { skipped: true, reason: 'No API key' };
      return pipelineResults;
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
- Los deducibles pueden ser: porcentajes ("10%"), montos fijos ("5 SMMLV"), o textos ("NO APLICA", "APLICA")`

    let geminiResult: QuoteExtraction;
    try {
      // Try structured extraction first
      geminiResult = await geminiService.extractStructured(
        preprocessed.text,
        prompt,
        extraction.metadata.pageCount
      );

      // If structured extraction returns 0 coverages, try text-based extraction
      if (!geminiResult.coverages || geminiResult.coverages.length === 0) {
        console.log(`   ⚠️  Structured extraction returned 0 coverages. Trying text-based extraction...`);
        const textResult = await geminiService.extractText(preprocessed.text, prompt);
        
        // Try to parse as JSON
        const repaired = parseJsonWithRepair(textResult);
        if (repaired.success && repaired.data && typeof repaired.data === 'object' && 'coverages' in repaired.data && Array.isArray((repaired.data as Record<string, unknown>).coverages) && ((repaired.data as Record<string, unknown>).coverages as unknown[]).length > 0) {
          console.log(`   ✅ Text extraction found ${((repaired.data as Record<string, unknown>).coverages as unknown[]).length} coverages!`);
          geminiResult = repaired.data as QuoteExtraction;
        }
      }

      pipelineResults.stages.gemini = {
        success: true,
        insurerName: geminiResult.insurerName,
        policyName: geminiResult.policyName,
        priceAnnual: geminiResult.priceAnnual,
        currency: geminiResult.currency,
        coverageCount: geminiResult.coverages?.length || 0,
      };

      console.log(`✅ Gemini extraction successful`);
      console.log(`   Aseguradora: ${geminiResult.insurerName}`);
      console.log(`   Póliza: ${geminiResult.policyName}`);
      console.log(`   Prima: ${geminiResult.priceAnnual?.toLocaleString('es-CO')} ${geminiResult.currency}`);
      console.log(`   Coberturas: ${geminiResult.coverages?.length || 0}`);

    } catch (geminiError: unknown) {
      const geminiMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.log(`❌ Gemini extraction failed: ${geminiMessage}`);
      
      // Try fallback: legacy extraction
      console.log(`   🔄 Trying legacy extraction...`);
      try {
        const legacyResult = await geminiService.extractText(preprocessed.text, prompt);
        console.log(`   ⚠️  Legacy extraction returned text (not structured)`);
        console.log(`   Length: ${legacyResult.length} chars`);
        
        // Try to parse as JSON
        const repaired = parseJsonWithRepair(legacyResult);
        if (repaired.success) {
          console.log(`   ✅ Repaired JSON from legacy response!`);
          geminiResult = repaired.data as QuoteExtraction;
          pipelineResults.stages.gemini = {
            success: true,
            fallback: true,
            insurerName: geminiResult.insurerName,
            coverageCount: geminiResult.coverages?.length || 0,
          };
        } else {
          pipelineResults.stages.gemini = {
            success: false,
            error: geminiMessage,
            fallbackFailed: true,
          };
          return pipelineResults;
        }
      } catch (legacyError: unknown) {
        const legacyMessage = legacyError instanceof Error ? legacyError.message : String(legacyError);
        console.log(`   ❌ Legacy extraction also failed: ${legacyMessage}`);
        pipelineResults.stages.gemini = {
          success: false,
          error: geminiMessage,
        };
        return pipelineResults;
      }
    }

    // === STAGE 4: THESAURUS NORMALIZATION ===
    console.log(`\n📚 STAGE 4: Thesaurus Normalization`);
    console.log('-'.repeat(50));

    const thesaurus = loadThesaurus();
    console.log(`✅ Thesaurus loaded: ${thesaurus.length} canonical terms`);

    if (geminiResult.coverages && geminiResult.coverages.length > 0) {
      // Filter and normalize coverages
      let normalizedCoverages = geminiResult.coverages.map((cov) => {
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

      // Remove duplicates based on canonical name (keep highest confidence)
      const seen = new Map<string, typeof normalizedCoverages[0]>();
      normalizedCoverages.forEach((cov) => {
        const existing = seen.get(cov.canonicalName);
        if (!existing || cov.confidence > existing.confidence) {
          seen.set(cov.canonicalName, cov);
        }
      });
      normalizedCoverages = Array.from(seen.values());

      // Filter out very low confidence mappings (< 0.3) which are likely errors
      normalizedCoverages = normalizedCoverages.filter((cov) => cov.confidence >= 0.3);

      const needsReviewCount = normalizedCoverages.filter((c) => c.needsReview).length;
      
      pipelineResults.stages.thesaurus = {
        success: true,
        coverageCount: normalizedCoverages.length,
        normalizedCount: normalizedCoverages.filter((c) => c.canonicalName !== c.originalName).length,
        needsReviewCount,
      };

      console.log(`✅ Normalized ${normalizedCoverages.length} coverages`);
      console.log(`   Mapped to canonical: ${normalizedCoverages.filter((c) => c.canonicalName !== c.originalName).length}`);
      console.log(`   Need review: ${needsReviewCount}`);
      
      console.log(`\n   Coverage mappings:`);
      normalizedCoverages.forEach((cov, i: number) => {
        const arrow = cov.originalName !== cov.canonicalName ? '→' : '=';
        const status = cov.needsReview ? '⚠️' : '✅';
        console.log(`   ${i+1}. ${status} "${cov.originalName}" ${arrow} "${cov.canonicalName}" (${formatPercentage(cov.confidence, 0)})`);
      });

      // Replace with normalized
      geminiResult.coverages = normalizedCoverages.map((c) => ({
        name: c.canonicalName,
        value: c.value,
        deductible: c.deductible,
        originalName: c.originalName,
        confidence: c.confidence,
      })) as QuoteExtraction['coverages'];
    } else {
      console.log('⚠️  No coverages to normalize');
      pipelineResults.stages.thesaurus = { success: true, coverageCount: 0 };
    }

    // === STAGE 5: VALIDATION ===
    console.log(`\n✅ STAGE 5: Validation & Confidence Scoring`);
    console.log('-'.repeat(50));

    const validation = validateQuote(geminiResult as unknown as import('../src/services/quoteParser').ParsedQuote);
    const confidence = calculateConfidence(geminiResult as unknown as import('../src/services/quoteParser').ParsedQuote, validation, true);

    pipelineResults.stages.validation = {
      isValid: validation.isValid,
      coverageCount: validation.coverageCount,
      flags: validation.flags.length,
      confidenceScore: confidence.score,
      needsReview: confidence.needsReview,
    };

    console.log(`✅ Validation complete`);
    console.log(`   Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`   Coverages: ${validation.coverageCount}/${validation.expectedCoverageCount}`);
    console.log(`   Flags: ${validation.flags.length}`);
    if (validation.flags.length > 0) {
      validation.flags.forEach((f) => {
        console.log(`     - [${f.severity}] ${f.code}: ${f.message}`);
      });
    }
    console.log(`   Confidence: ${confidence.score}/100 (${getConfidenceLabel(confidence.score)})`);
    console.log(`   Needs Review: ${confidence.needsReview ? '⚠️ YES' : '✅ No'}`);

    // === VALIDATION CHECKS (Tasks 5.2-5.5) ===
    console.log(`\n🎯 VALIDATION CHECKS`);
    console.log('-'.repeat(50));

    // 5.2: Confidence score >= 85
    const confidencePass = confidence.score >= 85;
    pipelineResults.validations.confidence = {
      check: 'Confidence >= 85',
      value: confidence.score,
      passed: confidencePass,
      status: confidencePass ? '✅ PASS' : '❌ FAIL',
    };
    console.log(`   ${confidencePass ? '✅' : '❌'} Confidence: ${confidence.score}/100 ${confidencePass ? '(>= 85)' : '(< 85)'}`);

    // 5.3: Premium detection (priceAnnual > 0)
    const premiumPass = geminiResult.priceAnnual > 0;
    pipelineResults.validations.premium = {
      check: 'Premium detected (priceAnnual > 0)',
      value: geminiResult.priceAnnual,
      passed: premiumPass,
      status: premiumPass ? '✅ PASS' : '❌ FAIL',
    };
    console.log(`   ${premiumPass ? '✅' : '❌'} Premium: ${geminiResult.priceAnnual?.toLocaleString('es-CO')} ${geminiResult.currency} ${premiumPass ? '(> 0)' : '(MISSING)'}`);

    // 5.4: Thesaurus mapping >= 80%
    const mappedCount = geminiResult.coverages?.filter((c) => c.originalName && c.name !== c.originalName).length || 0;
    const totalCoverages = geminiResult.coverages?.length || 0;
    const mappingRate = totalCoverages > 0 ? (mappedCount / totalCoverages) : 0;
    const mappingPass = mappingRate >= 0.8;
    pipelineResults.validations.thesaurusMapping = {
      check: 'Thesaurus mapping >= 80%',
      value: `${formatPercentage(mappingRate, 1)}`,
      passed: mappingPass,
      status: mappingPass ? '✅ PASS' : '❌ FAIL',
    };
    console.log(`   ${mappingPass ? '✅' : '❌'} Thesaurus mapping: ${formatPercentage(mappingRate, 1)} (${mappedCount}/${totalCoverages}) ${mappingPass ? '(>= 80%)' : '(< 80%)'}`);

    // 5.5: Section preservation (CHUBB >= 2000 chars after preprocessing)
    const sectionPass = preprocessed.metadata.cleanedLength >= 2000;
    pipelineResults.validations.sectionPreservation = {
      check: 'Section preservation >= 2000 chars',
      value: preprocessed.metadata.cleanedLength,
      passed: sectionPass,
      status: sectionPass ? '✅ PASS' : '❌ FAIL',
    };
    console.log(`   ${sectionPass ? '✅' : '❌'} Section preservation: ${preprocessed.metadata.cleanedLength} chars ${sectionPass ? '(>= 2000)' : '(< 2000)'}`);

    // Overall validation
    const allPassed = confidencePass && premiumPass && mappingPass && sectionPass;
    pipelineResults.validations.overall = {
      passed: allPassed,
      status: allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED',
    };
    console.log(`\n   ${allPassed ? '✅' : '❌'} OVERALL: ${allPassed ? 'All validations passed' : 'Some validations failed'}`);

    // === SAVE RESULTS ===
    const outputPath = pdfPath.replace('.pdf', '_pipeline_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(pipelineResults, null, 2));
    console.log(`\n💾 Results saved to: ${path.basename(outputPath)}`);

    return pipelineResults;

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Pipeline failed:`, message);
    pipelineResults.error = message;
    return pipelineResults;
  }
}

async function main() {
  console.log('\n🚀 Insurance Quote Pipeline Test');
  console.log('   Testing: PDF → Preprocess → Gemini → Thesaurus → Validation\n');

  // Check prerequisites
  console.log('Prerequisites:');
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set (AI extraction will be skipped)'}`);
  
  const thesaurusPath = path.join(process.cwd(), '..', 'tesauro(pyme).md');
  console.log(`  Thesaurus file: ${fs.existsSync(thesaurusPath) ? '✅ Found' : '❌ Not found'} (${thesaurusPath})`);
  console.log();

  // Test with available quotes
  const testQuotes = [
    { file: 'Cotización - MAPFRE.pdf', name: 'MAPFRE' },
    { file: 'Cotización - CHUBB.pdf', name: 'CHUBB' },
    { file: 'Cotización - BBVA.pdf', name: 'BBVA' },
    { file: 'Cotización - AXA Colpatria.pdf', name: 'AXA Colpatria' },
  ];

  const results: PipelineResult[] = [];

  for (const quote of testQuotes) {
    const pdfPath = path.join(QUOTES_DIR, quote.file);
    if (fs.existsSync(pdfPath)) {
      const result = await testPipeline(pdfPath, quote.name);
      results.push(result);
    } else {
      console.log(`\n⚠️  Skipping ${quote.name}: file not found`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 PIPELINE TEST SUMMARY');
  console.log(`${'='.repeat(70)}\n`);

  const successful = results.filter((r) => !r.error);
  const withGemini = results.filter((r) => r.stages?.gemini?.success);
  const withThesaurus = results.filter((r) => r.stages?.thesaurus?.success);

  console.log(`Total tested: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`With Gemini: ${withGemini.length}`);
  console.log(`With Thesaurus: ${withThesaurus.length}\n`);

  results.forEach((r) => {
    const geminiStatus = r.stages?.gemini?.success ? '✅' : 
                        r.stages?.gemini?.skipped ? '⏭️' : '❌';
    const thesStatus = r.stages?.thesaurus?.success ? '✅' : '❌';
    const confScore = r.stages?.validation?.confidenceScore || 'N/A';
    const validations = r.validations || {};
    
    console.log(`  ${r.insurerName}:`);
    console.log(`    PDF: ✅ | Preprocess: ✅ | Gemini: ${geminiStatus} | Thesaurus: ${thesStatus}`);
    if (r.stages?.validation) {
      console.log(`    Confidence: ${confScore}/100 | Coverages: ${r.stages.validation.coverageCount}`);
    }
    
    // Show validation checks
    if (validations.confidence) {
      const v = validations;
      console.log(`    Validations:`);
      console.log(`      Confidence >=85: ${v.confidence?.status || 'N/A'}`);
      console.log(`      Premium >0: ${v.premium?.status || 'N/A'}`);
      console.log(`      Mapping >=80%: ${v.thesaurusMapping?.status || 'N/A'}`);
      console.log(`      Sections >=2000: ${v.sectionPreservation?.status || 'N/A'}`);
      console.log(`      Overall: ${v.overall?.status || 'N/A'}`);
    }
    console.log();
  });

  if (!process.env.GEMINI_API_KEY) {
    console.log('💡 To test with Gemini, set your API key:');
    console.log('   export GEMINI_API_KEY=your_key_here');
    console.log('   Then run this script again.\n');
  }
}

main().catch(console.error);
