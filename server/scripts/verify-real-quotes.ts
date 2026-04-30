/**
 * Manual verification script for real quote PDFs
 * Tests text extraction and pre-processing on MAPFRE/CHUBB quotes
 * Run with: npx ts-node scripts/verify-real-quotes.ts
 */

import { pdfExtractor } from '../src/services/pdfExtractor';
import { preprocessText, detectNumberFormat } from '../src/services/textPreprocessor';
import fs from 'fs';
import path from 'path';

async function verifyQuote(pdfPath: string, insurerName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Verifying: ${insurerName}`);
  console.log(`   File: ${path.basename(pdfPath)}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Step 1: Extract text from PDF
    console.log('1️⃣  Extracting text from PDF...');
    const extractionResult = await pdfExtractor.extractTextFromPdf(pdfPath);
    console.log(`   ✓ Extracted ${extractionResult.text.length} characters`);
    console.log(`   ✓ Pages: ${extractionResult.metadata.pageCount}`);
    console.log(`   ✓ Warnings: ${extractionResult.warnings.length || 0}`);

    // Show first 200 chars of raw text
    console.log(`\n   Raw text preview:`);
    console.log(`   "${extractionResult.text.substring(0, 200)}..."`);

    // Step 2: Detect number format
    console.log(`\n2️⃣  Detecting number format...`);
    const numberFormat = detectNumberFormat(extractionResult.text);
    console.log(`   Format detected: ${numberFormat}`);

    // Step 3: Pre-process text
    console.log(`\n3️⃣  Pre-processing text...`);
    const preprocessed = preprocessText(
      extractionResult.text,
      extractionResult.metadata.pageCount,
      {
        normalizeNumbers: true,
        fixEncoding: true,
        removeArtifacts: true,
        extractSections: extractionResult.metadata.pageCount > 10,
      }
    );

    console.log(`   ✓ Original length: ${preprocessed.metadata.originalLength}`);
    console.log(`   ✓ Cleaned length: ${preprocessed.metadata.cleanedLength}`);
    console.log(`   ✓ Complexity: ${preprocessed.metadata.complexity}`);
    console.log(`   ✓ Changes made:`);
    preprocessed.metadata.changes.forEach(change => {
      console.log(`     - ${change}`);
    });

    // Show first 200 chars of preprocessed text
    console.log(`\n   Preprocessed text preview:`);
    console.log(`   "${preprocessed.text.substring(0, 200)}..."`);

    // Step 4: Check for specific fixes
    console.log(`\n4️⃣  Validation checks:`);
    const hasEncodingIssues = /CotizaciÃ³n|Ã³|Ã/.test(preprocessed.text);
    const hasColombianNumbers = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/.test(preprocessed.text);
    const hasNormalizedNumbers = /\d{4,}/.test(preprocessed.text);

    console.log(`   ${hasEncodingIssues ? '❌' : '✅'} Encoding issues ${hasEncodingIssues ? 'still present' : 'fixed'}`);
    console.log(`   ${hasColombianNumbers ? '⚠️' : '✅'} Colombian number format ${hasColombianNumbers ? 'still present (may need review)' : 'normalized'}`);
    console.log(`   ${hasNormalizedNumbers ? '✅' : '⚠️'} Large numbers present ${hasNormalizedNumbers ? '(normalization working)' : '(check number format)'}`);

    // Save preprocessed text for manual inspection
    const outputPath = pdfPath.replace('.pdf', '_preprocessed.txt');
    fs.writeFileSync(outputPath, preprocessed.text);
    console.log(`\n   💾 Preprocessed text saved to: ${path.basename(outputPath)}`);

    return {
      success: true,
      insurerName,
      originalLength: preprocessed.metadata.originalLength,
      cleanedLength: preprocessed.metadata.cleanedLength,
      complexity: preprocessed.metadata.complexity,
      encodingFixed: !hasEncodingIssues,
    };

  } catch (error) {
    console.error(`\n   ❌ Error processing ${insurerName}:`, error);
    return {
      success: false,
      insurerName,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('\n🔍 PDF Extraction Verification Tool');
  console.log('   Testing pre-processing pipeline on real insurance quotes\n');

  const quotesDir = path.join(process.cwd(), '..', '..', 'Ejemplos', 'laser-home');
  
  const quotes = [
    { file: 'Cotización - MAPFRE.pdf', name: 'MAPFRE' },
    { file: 'Cotización - CHUBB.pdf', name: 'CHUBB' },
  ];

  const results = [];

  for (const quote of quotes) {
    const pdfPath = path.join(quotesDir, quote.file);
    if (fs.existsSync(pdfPath)) {
      const result = await verifyQuote(pdfPath, quote.name);
      results.push(result);
    } else {
      console.log(`\n⚠️  File not found: ${quote.file}`);
      results.push({
        success: false,
        insurerName: quote.name,
        error: 'File not found',
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  successful.forEach(r => {
    console.log(`   ${r.insurerName}:`);
    console.log(`     - Original: ${r.originalLength?.toLocaleString()} chars`);
    console.log(`     - Cleaned: ${r.cleanedLength?.toLocaleString()} chars`);
    console.log(`     - Complexity: ${r.complexity}`);
    console.log(`     - Encoding: ${r.encodingFixed ? 'Fixed ✅' : 'Issues remain ❌'}`);
    console.log();
  });

  if (failed.length > 0) {
    failed.forEach(r => {
      console.log(`   ${r.insurerName}: ❌ ${r.error}`);
    });
  }

  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review the *_preprocessed.txt files created in Ejemplos/laser-home/`);
  console.log(`   2. Verify Colombian number formats are correctly normalized`);
  console.log(`   3. Check that coverage names are properly encoded`);
  console.log(`   4. Run full analysis with GEMINI_API_KEY to test AI extraction\n`);
}

main().catch(console.error);
