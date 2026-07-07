import { pdfExtractor } from './src/services/pdfExtractor';
import { geminiService } from './src/services/gemini';
import { mapCoverageName } from './src/services/thesaurusMapper';
import { PLANTILLA_ITEMS } from './src/utils/analysisValidator';
import { formatPercentage } from './src/utils/formatCurrency';

type GeminiQuoteExtraction = Awaited<ReturnType<typeof geminiService.extractStructured>>;

const STRUCTURED_EXTRACTION_PROMPT = `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

### EJEMPLO DE ENTRADA/SALIDA

Ejemplo - Cotización estándar:
ENTRADA: "Seguros Bolívar presenta: Póliza Empresarial Plus. Prima anual: $8.500.000 COP. Coberturas: Incendio Edificio $500M (ded 10%), RC $100M (ded 5 SMMLV)..."

SALIDA ESPERADA:
{
  "insurerName": "Seguros Bolívar",
  "policyName": "Empresarial Plus",
  "priceAnnual": 8500000,
  "currency": "COP",
  "validityPeriod": "2024-01-01 - 2024-12-31",
  "coverages": [
    {
      "name": "Incendio (Edificio y Contenidos)",
      "value": "500.000.000",
      "deductible": "10%"
    },
    {
      "name": "Responsabilidad Civil (RCE)",
      "value": "100.000.000",
      "deductible": "5 SMMLV"
    }
  ],
  "specialConditions": ["Aplica cláusula de ajuste por inflación"],
  "expectedCoverages": [
    { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
    { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
    { "name": "Sustracción / Hurto", "status": "present", "value": "100M", "deductible": "10%" },
    { "name": "Equipo Eléctrico y Electrónico", "status": "present", "value": "50M", "deductible": "No aplica" },
    { "name": "Rotura de Maquinaria", "status": "present", "value": "50M", "deductible": "15%" },
    { "name": "Responsabilidad Civil (RCE)", "status": "present", "value": "100M", "deductible": "5 SMMLV" },
    { "name": "Vidrios Planos", "status": "missing", "value": null, "deductible": null },
    { "name": "Manejo Global / Infidelidad", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Mercancías", "status": "missing", "value": null, "deductible": null },
    { "name": "Transporte de Valores", "status": "missing", "value": null, "deductible": null },
    { "name": "Asistencia PYME", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Asistencia Legal", "status": "present", "value": "Incluido", "deductible": "No aplica" },
    { "name": "Huelga, Motín, Asonada (HMACC)", "status": "missing", "value": null, "deductible": null },
    { "name": "Terremoto y Eventos Catastróficos", "status": "present", "value": "200M", "deductible": "20%" }
  ]
}

### REGLAS CRÍTICAS

1. Nombres de coberturas: Usa EXACTAMENTE estos 14 nombres canónicos:
   - "Incendio (Edificio y Contenidos)"
   - "Lucro Cesante"
   - "Sustracción / Hurto"
   - "Equipo Eléctrico y Electrónico"
   - "Rotura de Maquinaria"
   - "Responsabilidad Civil (RCE)"
   - "Vidrios Planos"
   - "Manejo Global / Infidelidad"
   - "Transporte de Mercancías"
   - "Transporte de Valores"
   - "Asistencia PYME"
   - "Asistencia Legal"
   - "Huelga, Motín, Asonada (HMACC)"
   - "Terremoto y Eventos Catastróficos"

2. Si una cobertura no aparece en el documento, inclúyela con:
   { "name": "[Nombre exacto de plantilla]", "value": "NO ESPECIFICADO", "deductible": "" }

3. NO inventes coberturas que no estén en el documento.

4. Formato de deducibles:
   - Porcentaje: "10%" o "10% / Mín. 2 SMMLV"
   - Fijo: "5 SMMLV" o "$500.000"
   - No aplica: "No aplica"

5. Prima anual: Extrae solo el número, sin símbolos de moneda.

6. expectedCoverages: Incluye TODAS las 14 coberturas canónicas con su estado:
   - "present": La cobertura aparece en el documento
   - "missing": La cobertura no aparece pero debería estar
   - "excluded": La cobertura fue explícitamente excluida
   
   Ejemplo:
   "expectedCoverages": [
     { "name": "Incendio (Edificio y Contenidos)", "status": "present", "value": "500M", "deductible": "10%" },
     { "name": "Lucro Cesante", "status": "missing", "value": null, "deductible": null },
     { "name": "Transporte de Mercancías", "status": "excluded", "value": "No contratado", "deductible": null }
   ]

7. Devuelve SOLO el JSON, sin texto adicional.`;

interface QuoteFile {
  path: string;
  filename: string;
}

const quoteFiles: QuoteFile[] = [
  {
    path: '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - CHUBB.pdf',
    filename: 'CHUBB',
  },
  {
    path: '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - MAPFRE.pdf',
    filename: 'MAPFRE',
  },
  {
    path: '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - BBVA.pdf',
    filename: 'BBVA',
  },
  {
    path: '/home/foxnet360/Documentos/dev/Corredores/Comparador-CSA_DEF/Ejemplos/laser-home/Cotización - AXA Colpatria.pdf',
    filename: 'AXA Colpatria',
  },
];

function printSeparator(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

function printSubSeparator(title: string) {
  console.log('\n' + '-'.repeat(60));
  console.log(`  ${title}`);
  console.log('-'.repeat(60));
}

async function analyzeQuote(file: QuoteFile) {
  printSeparator(`ANALIZANDO: ${file.filename}`);

  // Step 1: Extract text from PDF
  console.log('\n📄 STEP 1: Extracting text from PDF...');
  let extractedText: string;
  try {
    const extraction = await pdfExtractor.extractTextFromPdf(file.path);
    extractedText = extraction.text;
    console.log(`   ✅ Extracted ${extractedText.length} characters`);
    console.log(`   📊 Pages: ${extraction.metadata.pageCount}, Scanned: ${extraction.isScanned}`);

    // Show first 500 chars
    console.log('\n   📝 First 500 chars of extracted text:');
    console.log('   ' + '-'.repeat(50));
    console.log('   ' + extractedText.substring(0, 500).replace(/\n/g, '\n   '));
    console.log('   ' + '-'.repeat(50));
  } catch (error) {
    console.error(`   ❌ Failed to extract PDF: ${error}`);
    return;
  }

  // Step 2: Run Gemini structured extraction
  console.log('\n🤖 STEP 2: Running Gemini structured extraction...');
  let structuredResult: GeminiQuoteExtraction;
  try {
    structuredResult = await geminiService.extractStructured(
      extractedText,
      STRUCTURED_EXTRACTION_PROMPT,
      1
    );
    console.log(
      `   ✅ Extracted: ${structuredResult.insurerName}, ${structuredResult.coverages?.length || 0} coverages`
    );
  } catch (error) {
    console.error(`   ❌ Gemini extraction failed: ${error}`);
    return;
  }

  // Step 3: Log RAW coverage names from Gemini (before thesaurus mapping)
  printSubSeparator('STEP 3: RAW Coverage Names from Gemini (Before Thesaurus Mapping)');
  const rawCoverages = structuredResult.coverages || [];
  console.log(`\n   Total raw coverages returned: ${rawCoverages.length}`);

  if (rawCoverages.length === 0) {
    console.log('   ⚠️  WARNING: Gemini returned ZERO coverages!');
  } else {
    rawCoverages.forEach((coverage, idx: number) => {
      console.log(`   ${idx + 1}. "${coverage.name}"`);
      console.log(`      Value: "${coverage.value}"`);
      console.log(`      Deductible: "${coverage.deductible}"`);
    });
  }

  // Step 4: Apply thesaurus mapping and log results
  printSubSeparator('STEP 4: Coverage Names AFTER Thesaurus Mapping');

  const mappedCoverages = rawCoverages.map((coverage) => {
    const mapping = mapCoverageName(coverage.name);
    return {
      rawName: coverage.name,
      canonicalName: mapping.canonicalName,
      confidence: mapping.confidence,
      matchedVariant: mapping.matchedVariant,
      needsReview: mapping.needsReview,
      value: coverage.value,
      deductible: coverage.deductible,
    };
  });

  console.log(`\n   Mapped coverages: ${mappedCoverages.length}`);
  mappedCoverages.forEach((coverage, idx: number) => {
    const status = coverage.needsReview ? '⚠️ NEEDS REVIEW' : '✅ OK';
    console.log(`   ${idx + 1}. "${coverage.rawName}"`);
    console.log(`      → Canonical: "${coverage.canonicalName}"`);
    console.log(`      → Confidence: ${formatPercentage(coverage.confidence, 1)}`);
    console.log(`      → Matched Variant: "${coverage.matchedVariant}"`);
    console.log(`      → Status: ${status}`);
  });

  // Step 5: Compare against PLANTILLA_ITEMS
  printSubSeparator('STEP 5: Comparison with Frontend PLANTILLA_ITEMS');

  const backendCoverageNames = mappedCoverages.map((c) => c.canonicalName);
  const missingItems: string[] = [];
  const matchedItems: Array<{ frontend: string; backend: string; matchType: string }> = [];

  console.log('\n   Frontend Item → Backend Coverage Match:');
  console.log('   ' + '-'.repeat(70));

  for (const frontendItem of PLANTILLA_ITEMS) {
    // Check exact match
    const exactMatch = backendCoverageNames.find((name: string) => name === frontendItem);

    // Check fuzzy match
    const fuzzyMatch = backendCoverageNames.find((name: string) => {
      const normalizedFrontend = frontendItem
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const normalizedBackend = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return (
        normalizedFrontend === normalizedBackend ||
        normalizedFrontend.includes(normalizedBackend) ||
        normalizedBackend.includes(normalizedFrontend)
      );
    });

    if (exactMatch) {
      console.log(`   ✅ "${frontendItem}"`);
      console.log(`      → Exact match: "${exactMatch}"`);
      matchedItems.push({ frontend: frontendItem, backend: exactMatch, matchType: 'Exact' });
    } else if (fuzzyMatch) {
      console.log(`   🟡 "${frontendItem}"`);
      console.log(`      → Fuzzy match: "${fuzzyMatch}"`);
      matchedItems.push({ frontend: frontendItem, backend: fuzzyMatch, matchType: 'Fuzzy' });
    } else {
      console.log(`   ❌ "${frontendItem}"`);
      console.log(`      → No match found - will show "No Especificado"`);
      missingItems.push(frontendItem);
    }
  }

  // Step 6: Show which frontend items don't match
  printSubSeparator('STEP 6: Frontend Items WITHOUT Backend Match (Will Show "No Especificado")');

  if (missingItems.length === 0) {
    console.log('\n   ✅ All frontend items have a backend match!');
  } else {
    console.log(`\n   ❌ ${missingItems.length} items will show "No Especificado":`);
    missingItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. "${item}"`);
    });
  }

  // Step 7: Summary table
  printSubSeparator('STEP 7: Summary Table');

  const totalItems = PLANTILLA_ITEMS.length;
  const matchedCount = matchedItems.length;
  const missingCount = missingItems.length;
  const matchPercentage = formatPercentage(matchedCount / totalItems, 1);

  console.log('\n   ┌─────────────────────────────────────────────────────────────────────┐');
  console.log('   │ Frontend Item                          │ Backend Coverage         │ Match │');
  console.log('   ├─────────────────────────────────────────────────────────────────────┤');

  for (const item of PLANTILLA_ITEMS) {
    const match = matchedItems.find((m) => m.frontend === item);
    const frontendShort = item.length > 38 ? item.substring(0, 35) + '...' : item;
    const backendShort = match
      ? match.backend.length > 24
        ? match.backend.substring(0, 21) + '...'
        : match.backend
      : 'No Especificado';
    const matchType = match ? match.matchType : 'MISSING';

    console.log(
      `   │ ${frontendShort.padEnd(38)} │ ${backendShort.padEnd(24)} │ ${matchType.padEnd(5)} │`
    );
  }

  console.log('   └─────────────────────────────────────────────────────────────────────┘');
  console.log(`\n   📊 MATCH STATISTICS:`);
  console.log(`      Total frontend items: ${totalItems}`);
  console.log(`      Matched: ${matchedCount} (${matchPercentage})`);
  console.log(
    `      Missing (No Especificado): ${missingCount} (${formatPercentage(missingCount / totalItems, 1)})`
  );

  // Show all unique backend coverage names found
  const uniqueBackendNames = [...new Set(backendCoverageNames)];
  console.log(`\n   📋 All Unique Backend Coverage Names Found (${uniqueBackendNames.length}):`);
  uniqueBackendNames.forEach((name, idx) => {
    console.log(`      ${idx + 1}. "${name}"`);
  });

  return {
    filename: file.filename,
    rawCoverageCount: rawCoverages.length,
    mappedCoverageCount: mappedCoverages.length,
    matchedCount,
    missingCount,
    matchPercentage: parseFloat(matchPercentage),
    missingItems,
    rawCoverages: rawCoverages.map((c) => c.name),
    mappedCoverages: mappedCoverages.map((c) => ({ raw: c.rawName, canonical: c.canonicalName })),
  };
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  DEBUG COVERAGE MATCH - Analyzing 4 Real Quote PDFs');
  console.log('  This script will show exactly why items show "No Especificado"');
  console.log('='.repeat(80));

  const results = [];

  for (const file of quoteFiles) {
    try {
      const result = await analyzeQuote(file);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Fatal error analyzing ${file.filename}:`, error);
    }
  }

  // Final summary across all quotes
  printSeparator('FINAL SUMMARY ACROSS ALL QUOTES');

  console.log('\n   ┌──────────────────────┬────────────┬────────────┬────────────┬──────────┐');
  console.log('   │ Quote                │ Raw Covgs  │ Mapped     │ Matched    │ Match %  │');
  console.log('   ├──────────────────────┼────────────┼────────────┼────────────┼──────────┤');

  for (const result of results) {
    console.log(
      `   │ ${result.filename.padEnd(20)} │ ${result.rawCoverageCount.toString().padEnd(10)} │ ${result.mappedCoverageCount.toString().padEnd(10)} │ ${result.matchedCount.toString().padEnd(10)} │ ${formatPercentage(result.matchPercentage / 100, 1).padEnd(8)} │`
    );
  }

  console.log('   └──────────────────────┴────────────┴────────────┴────────────┴──────────┘');

  // Show most common missing items
  const missingCount: Record<string, number> = {};
  for (const result of results) {
    for (const item of result.missingItems) {
      missingCount[item] = (missingCount[item] || 0) + 1;
    }
  }

  console.log('\n   ❌ Most Common Missing Items (across all quotes):');
  const sortedMissing = Object.entries(missingCount).sort((a, b) => b[1] - a[1]);
  if (sortedMissing.length === 0) {
    console.log('      None - all items matched in all quotes!');
  } else {
    sortedMissing.forEach(([item, count], idx) => {
      console.log(`      ${idx + 1}. "${item}" - missing in ${count}/${results.length} quotes`);
    });
  }

  // Show all unique raw names found across all quotes
  const allRawNames = new Set<string>();
  for (const result of results) {
    for (const name of result.rawCoverages) {
      allRawNames.add(name);
    }
  }

  console.log('\n   📋 All Unique RAW Coverage Names Found Across All Quotes:');
  const sortedRawNames = Array.from(allRawNames).sort();
  sortedRawNames.forEach((name, idx) => {
    console.log(`      ${idx + 1}. "${name}"`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('  ANALYSIS COMPLETE');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
