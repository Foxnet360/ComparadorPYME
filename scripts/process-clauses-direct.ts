#!/usr/bin/env ts-node
/**
 * Direct Clause Processing Script
 *
 * Processes local clause PDFs directly using DocumentIndexingService
 * This bypasses the HTTP upload and stores directly in the unified chunks table
 * Usage: npx tsx scripts/process-clauses-direct.ts
 */

import { DocumentIndexingService } from '../server/src/services/documentIndexingService';
import * as fs from 'fs';
import * as path from 'path';

const clauseFiles = [
  {
    filePath: 'Ejemplos/laser-home/Clausulados/Clausulado - BBVA.pdf',
    insurerName: 'BBVA',
    documentName: 'Clausulado BBVA PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/laser-home/Clausulados/Clausulado - AXA Colpatria.pdf',
    insurerName: 'AXA Colpatria',
    documentName: 'Clausulado AXA Colpatria PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/laser-home/Clausulados/Clausulado - CHUBB.pdf',
    insurerName: 'CHUBB',
    documentName: 'Clausulado CHUBB PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/laser-home/Clausulados/Clausulado - MAPFRE.pdf',
    insurerName: 'MAPFRE',
    documentName: 'Clausulado MAPFRE PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/Pachito-el-chef/CLAUSULADOS/CLAUSULADO HDI.pdf',
    insurerName: 'HDI',
    documentName: 'Clausulado HDI PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/Pachito-el-chef/CLAUSULADOS/CLAUSULADO MAPFRE.pdf',
    insurerName: 'MAPFRE',
    documentName: 'Clausulado MAPFRE PYME V2',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
  {
    filePath: 'Ejemplos/Pachito-el-chef/CLAUSULADOS/CLAUSULADO SBS.pdf',
    insurerName: 'SBS',
    documentName: 'Clausulado SBS PYME',
    documentType: 'CLAUSULADO_GENERAL' as const,
  },
];

async function processClauses() {
  console.log('🚀 [process-clauses-direct] Starting direct clause processing\n');

  const indexer = new DocumentIndexingService((progress) => {
    console.log(`   [${progress.stage}] ${progress.message} (${progress.percent}%)`);
  });

  let successCount = 0;
  let failCount = 0;

  for (const clause of clauseFiles) {
    const fullPath = path.resolve(clause.filePath);

    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      failCount++;
      continue;
    }

    console.log(`🔍 Processing: ${clause.documentName} (${clause.insurerName})`);
    console.log(`   File: ${fullPath}`);

    try {
      const result = await indexer.indexDocument(fullPath, {
        insurerName: clause.insurerName,
        documentName: clause.documentName,
        documentType: clause.documentType,
        uploadedBy: 'system-reindex',
      });

      if (result.success) {
        console.log(`   ✅ Success! Document ID: ${result.documentId}`);
        console.log(
          `   📊 Stats: ${result.stats.chunksCreated} chunks, ${result.stats.totalPages} pages`
        );
        successCount++;
      } else {
        console.error(`   ❌ Failed: ${result.errors.join(', ')}`);
        failCount++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
      failCount++;
    }

    console.log('');
  }

  console.log('📊 Processing Summary:');
  console.log(`   Total documents: ${clauseFiles.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`\n✅ Direct processing complete!`);
}

processClauses().catch(console.error);
