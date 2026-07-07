import { pdfExtractor } from './src/services/pdfExtractor';
import { preprocessText } from './src/services/textPreprocessor';
import { geminiService } from './src/services/gemini';
import { parseJsonWithRepair } from './src/services/jsonRepair';

interface ExtractedCoverageItem {
  name: string;
  value: string | null;
  deductible: string | null;
}

interface QuoteExtraction {
  insurerName?: string;
  policyName?: string;
  priceAnnual?: number;
  currency?: string;
  coverages?: ExtractedCoverageItem[];
}

const PDF_PATH =
  '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - BBVA.pdf';

const PROMPT = `Extrae TODAS las coberturas de esta cotización de seguros. 
Devuelve el resultado en formato JSON con esta estructura exacta:
{
  "insurerName": "...",
  "policyName": "...", 
  "priceAnnual": 1234567,
  "currency": "COP",
  "coverages": [
    {"name": "...", "value": "...", "deductible": "..."}
  ]
}

Busca en tablas de coberturas. Extrae el nombre exacto, el valor asegurado y el deducible de cada cobertura.`;

async function main() {
  console.log('=== DEBUG BBVA PDF EXTRACTION ===\n');

  // Step 1: Extract text from PDF
  console.log('1. Extracting text from PDF...');
  const extraction = await pdfExtractor.extractTextFromPdf(PDF_PATH);
  console.log(
    `   - Extracted ${extraction.text.length} chars from ${extraction.pages.length} pages`
  );
  console.log(`   - Pages with content: ${extraction.pages.filter((p) => p.hasContent).length}`);
  console.log(`   - Is scanned: ${extraction.isScanned}`);
  if (extraction.warnings.length > 0) {
    console.log(`   - Warnings: ${extraction.warnings.join(', ')}`);
  }
  console.log();

  // Step 2: Preprocess text
  console.log('2. Preprocessing text...');
  const preprocessed = preprocessText(extraction.text, extraction.pages.length);
  console.log(`   - Original length: ${preprocessed.metadata.originalLength} chars`);
  console.log(`   - Cleaned length: ${preprocessed.metadata.cleanedLength} chars`);
  console.log(`   - Complexity: ${preprocessed.metadata.complexity}`);
  console.log(`   - Changes: ${preprocessed.metadata.changes.join(', ') || 'none'}`);
  console.log();

  // Step 3: Call Gemini
  console.log('3. Calling Gemini extractText()...');
  const rawResponse = await geminiService.extractText(preprocessed.text, PROMPT);
  console.log(`   - Response length: ${rawResponse.length} chars`);
  console.log();

  // Step 4: Print raw response (first 2000 chars)
  console.log('4. RAW GEMINI RESPONSE (first 2000 chars):');
  console.log('---');
  console.log(rawResponse.substring(0, 2000));
  console.log('---');
  if (rawResponse.length > 2000) {
    console.log(`... (${rawResponse.length - 2000} more chars)`);
  }
  console.log();

  // Step 5: Try to parse JSON
  console.log('5. Parsing JSON with repair...');
  const parseResult = parseJsonWithRepair(rawResponse);
  console.log(`   - Success: ${parseResult.success}`);
  console.log(`   - Was repaired: ${parseResult.wasRepaired}`);
  if (parseResult.repairType) {
    console.log(`   - Repair type: ${parseResult.repairType}`);
  }
  if (!parseResult.success) {
    console.log(`   - Error: ${parseResult.error}`);
  }
  console.log();

  // Step 6: Count coverages
  console.log('6. RESULTS:');
  if (parseResult.success && parseResult.data) {
    const data = parseResult.data as QuoteExtraction;
    const coverages = data.coverages ?? [];
    console.log(`   - Insurer: ${data.insurerName || 'N/A'}`);
    console.log(`   - Policy: ${data.policyName || 'N/A'}`);
    console.log(`   - Price Annual: ${data.priceAnnual || 'N/A'} ${data.currency || ''}`);
    console.log(`   - Number of coverages found: ${coverages.length}`);
    if (coverages.length > 0) {
      console.log('\n   First 5 coverages:');
      coverages.slice(0, 5).forEach((c, i: number) => {
        console.log(`   ${i + 1}. ${c.name} | Value: ${c.value} | Deductible: ${c.deductible}`);
      });
    }
  } else {
    console.log('   - Could not parse JSON response');
  }

  console.log('\n=== END DEBUG ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
