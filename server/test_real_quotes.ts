import { pdfExtractor } from './src/services/pdfExtractor.js';
import { preprocessText } from './src/services/textPreprocessor.js';
import { quoteParser } from './src/services/quoteParser.js';
import { normalizeCoverages } from './src/services/thesaurusMapper.js';
import { validateQuote } from './src/services/quoteValidator.js';
import { calculateConfidence } from './src/services/confidenceScorer.js';
import { formatPercentage } from './src/utils/formatCurrency';

type PipelineResult =
  | {
      filename: string;
      success: true;
      pages: number;
      charCount: number;
      confidence: number;
      coverageCount: number;
      validationErrors: number;
      textSample: string;
    }
  | {
      filename: string;
      success: false;
      error: string;
    };

const PDF_FILES = [
  '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - MAPFRE.pdf',
  '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - CHUBB.pdf',
  '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - BBVA.pdf',
  '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - AXA Colpatria.pdf',
];

async function testPdf(filePath: string) {
  const filename = filePath.split('/').pop() || filePath;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${filename}`);
  console.log('='.repeat(60));

  try {
    // 1. Extract text from PDF
    const extraction = await pdfExtractor.extractTextFromPdf(filePath);
    console.log(`\n📊 EXTRACTION METRICS:`);
    console.log(`   Pages: ${extraction.metadata.pageCount}`);
    console.log(`   Pages with content: ${extraction.pages.filter((p) => p.hasContent).length}`);
    console.log(`   Is scanned: ${extraction.isScanned}`);
    console.log(`   Warnings: ${extraction.warnings.length}`);
    if (extraction.warnings.length > 0) {
      extraction.warnings.forEach((w) => console.log(`   ⚠️  ${w}`));
    }

    // 2. Preprocess text
    const preprocessed = preprocessText(extraction.text, extraction.metadata.pageCount);
    console.log(`\n🧹 PREPROCESSING:`);
    console.log(`   Original length: ${preprocessed.metadata.originalLength}`);
    console.log(`   Cleaned length: ${preprocessed.metadata.cleanedLength}`);
    console.log(`   Complexity: ${preprocessed.metadata.complexity}`);
    console.log(`   Changes: ${preprocessed.metadata.changes.join(', ') || 'None'}`);

    // 3. Parse quote (legacy regex parser)
    const parsed = quoteParser.parse(preprocessed.text);
    console.log(`\n🔍 PARSER RESULTS:`);
    console.log(`   Insurer: ${parsed.insurerName}`);
    console.log(`   Policy: ${parsed.policyName}`);
    console.log(`   Price: ${parsed.priceAnnual} ${parsed.currency}`);
    console.log(`   Coverages found: ${parsed.coverages.length}`);
    console.log(`   Parse confidence: ${parsed.parseConfidence}%`);

    // 4. Map coverages through thesaurus
    const mapped = normalizeCoverages(
      parsed.coverages.map((c) => ({
        name: c.name,
        value: c.value,
        deductible: c.deductible,
      }))
    );
    console.log(`\n📚 THESAURUS MAPPING:`);
    console.log(`   Mapped coverages: ${mapped.normalized.length}`);
    console.log(`   Needs review: ${mapped.needsReview}`);
    if (mapped.normalized.length > 0) {
      mapped.normalized.slice(0, 5).forEach((c) => {
        console.log(
          `   • ${c.name} (confidence: ${formatPercentage(c.confidence, 1)})${c.type ? ` [${c.type}]` : ''}`
        );
      });
      if (mapped.normalized.length > 5) {
        console.log(`   ... and ${mapped.normalized.length - 5} more`);
      }
    }

    // 5. Validate
    const validation = validateQuote(parsed);
    console.log(`\n✅ VALIDATION:`);
    console.log(`   Valid: ${validation.isValid}`);
    console.log(
      `   Coverage count: ${validation.coverageCount}/${validation.expectedCoverageCount}`
    );
    console.log(`   Numeric parse success: ${validation.numericParseSuccess}`);
    if (validation.flags.length > 0) {
      console.log(`   Flags (${validation.flags.length}):`);
      validation.flags.forEach((f) => {
        console.log(`   [${f.severity}] ${f.code}: ${f.message}`);
      });
    }

    // 6. Calculate confidence
    const confidence = calculateConfidence(parsed, validation);
    console.log(`\n🎯 CONFIDENCE SCORE:`);
    console.log(`   Overall: ${confidence.score}/100`);
    console.log(`   Coverage completeness: ${confidence.breakdown.coverageCompleteness}%`);
    console.log(`   Numeric parse success: ${confidence.breakdown.numericParseSuccess}%`);
    console.log(`   Validation pass rate: ${confidence.breakdown.validationPassRate}%`);
    console.log(`   Schema compliance: ${confidence.breakdown.schemaCompliance}%`);
    console.log(`   Needs review: ${confidence.needsReview}`);
    console.log(`   Is critical: ${confidence.isCritical}`);

    // 7. Sample text
    console.log(`\n📝 TEXT SAMPLE (first 500 chars):`);
    console.log(preprocessed.text.substring(0, 500).replace(/\n/g, ' '));

    return {
      filename,
      success: true,
      pages: extraction.metadata.pageCount,
      charCount: preprocessed.metadata.cleanedLength,
      confidence: confidence.score,
      coverageCount: parsed.coverages.length,
      validationErrors: validation.flags.filter(
        (f) => f.severity === 'CRITICAL' || f.severity === 'WARNING'
      ).length,
      textSample: preprocessed.text.substring(0, 500),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERROR processing ${filename}:`);
    console.error(`   ${message}`);
    return {
      filename,
      success: false,
      error: message,
    };
  }
}

async function main() {
  console.log('🚀 REAL QUOTE PDF PIPELINE TEST');
  console.log(
    'Testing PDF extraction + preprocessing + parsing + thesaurus + validation + confidence\n'
  );

  const results: PipelineResult[] = [];
  for (const file of PDF_FILES) {
    const result = await testPdf(file);
    results.push(result);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));

  results.forEach((r) => {
    if (r.success) {
      console.log(`\n✅ ${r.filename}`);
      console.log(
        `   Pages: ${r.pages} | Chars: ${r.charCount} | Confidence: ${r.confidence}% | Coverages: ${r.coverageCount} | Issues: ${r.validationErrors}`
      );
    } else {
      console.log(`\n❌ ${r.filename}`);
      console.log(`   ERROR: ${r.error}`);
    }
  });
}

main().catch(console.error);
