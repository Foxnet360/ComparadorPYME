#!/usr/bin/env ts-node
/**
 * Re-index Clause Documents Script
 * 
 * Re-indexes existing clause documents from the documents table into clause_chunks.
 * Usage: npx ts-node scripts/reindex-clauses.ts
 */

import { supabase } from '../server/src/config/database';
import { clauseIndexer } from '../server/src/services/clauseIndexer';
import fs from 'fs';
import path from 'path';

const downloadDir = '/tmp/reindex-downloads';

interface DocumentRecord {
  id: string;
  insurer_id: string;
  document_name: string;
  document_type: string;
  storage_path: string;
  insurers?: { name: string };
}

async function downloadDocument(document: DocumentRecord): Promise<string | null> {
  try {
    // Download from Supabase Storage
    const { data, error } = await supabase.storage
      .from('clause-pages')
      .download(document.storage_path);

    if (error) {
      console.error(`❌ Failed to download ${document.document_name}:`, error);
      return null;
    }

    if (!data) {
      console.error(`❌ No data returned for ${document.document_name}`);
      return null;
    }

    // Save to temp file
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const filePath = path.join(downloadDir, `${document.id}.pdf`);
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`   📥 Downloaded: ${document.document_name} (${buffer.length} bytes)`);
    return filePath;
  } catch (error) {
    console.error(`❌ Error downloading ${document.document_name}:`, error);
    return null;
  }
}

async function reindexClauses() {
  console.log('🚀 [reindex-clauses] Starting re-indexation of clause documents\n');

  try {
    // 1. Get all active clause documents
    console.log('📋 Fetching clause documents from database...');
    
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        insurer_id,
        document_name,
        document_type,
        storage_path,
        insurers:insurer_id (name)
      `)
      .in('document_type', ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR'])
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      console.log('ℹ️ No clause documents found to re-index');
      return;
    }

    console.log(`✅ Found ${documents.length} clause documents to re-index\n`);

    // 2. Process each document
    let successCount = 0;
    let failCount = 0;

    for (const doc of documents as DocumentRecord[]) {
      console.log(`🔍 Processing: ${doc.document_name} (${doc.document_type})`);
      console.log(`   ID: ${doc.id}`);

      try {
        // Download the PDF
        const filePath = await downloadDocument(doc);
        
        if (!filePath) {
          failCount++;
          continue;
        }

        // Re-index using clauseIndexer
        const insurerName = doc.insurers?.name || 'Unknown';
        
        const jobId = await clauseIndexer.startIndexing(filePath, {
          insurerName,
          documentType: doc.document_type,
          documentName: doc.document_name,
          documentId: doc.id,
        });

        console.log(`   ✅ Re-index job started: ${jobId}`);
        successCount++;

        // Clean up downloaded file
        fs.unlinkSync(filePath);

      } catch (error) {
        console.error(`   ❌ Failed to re-index ${doc.document_name}:`, error);
        failCount++;
      }

      console.log(''); // Empty line for readability
    }

    // 3. Summary
    console.log('📊 Re-indexation Summary:');
    console.log(`   Total documents: ${documents.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`\n✅ Re-indexation complete!`);

    // Clean up download directory
    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true });
      console.log(`   🧹 Cleaned up temp directory`);
    }

  } catch (error) {
    console.error('❌ [reindex-clauses] Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  reindexClauses();
}

export { reindexClauses };
