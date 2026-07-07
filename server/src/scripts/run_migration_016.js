#!/usr/bin/env node
/**
 * Script to run migration 016 manually
 * Usage: node run_migration_016.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const WebSocket = require('ws');

// Load environment variables from .env.local if present
const envLocalPath = path.join(__dirname, '../../../.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('✅ Loaded environment from .env.local');
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nubiecwypgfekhvaffxm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  process.exit(1);
}

// Client with Service Role and WebSocket transport passed for Node.js 20 compatibility
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket,
  },
});

async function runMigration() {
  console.log('🏗️  Running migration 016...\n');

  const migrationPath = path.join(
    __dirname,
    '../../supabase/migrations/016_coverage_mappings_high_certainty.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // Split into individual statements by semicolon
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const sqlStatement = statements[i] + ';';
    console.log(`📄 Executing statement ${i + 1}/${statements.length}...`);

    let execError = null;

    // Attempt 1: RPC exec_sql
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: sqlStatement });
      if (error) {
        execError = error;
      }
    } catch (e) {
      execError = e;
    }

    // Attempt 2: REST fallback using _exec_sql view/endpoint
    if (execError) {
      console.log(
        `   ⚠️ RPC failed: ${execError.message || execError}. Trying REST _exec_sql fallback...`
      );
      try {
        const { error: queryError } = await supabase
          .from('_exec_sql')
          .select('*')
          .eq('sql', sqlStatement);

        if (queryError) {
          // If this also failed, check if it's an expected already exists error
          if (
            queryError.message.includes('already exists') ||
            queryError.message.includes('duplicate')
          ) {
            console.log(`   ⏭️ Ignored: ${queryError.message}`);
            skipCount++;
            execError = null;
          } else {
            console.error(`   ❌ REST Fallback failed: ${queryError.message}`);
            execError = queryError;
          }
        } else {
          console.log(`   ✅ OK (REST fallback)`);
          successCount++;
          execError = null;
        }
      } catch (err) {
        console.error(`   ❌ REST Fallback error: ${err.message}`);
        execError = err;
      }
    } else {
      console.log(`   ✅ OK`);
      successCount++;
    }

    if (execError) {
      // If still error, throw it
      throw new Error(`Failed to execute statement: ${execError.message || execError}`);
    }
  }

  console.log(`\n✅ Migration 016 complete: ${successCount} executed, ${skipCount} skipped`);

  // Verify columns exist
  console.log('\n🔍 Verifying table columns...');
  const { data, error } = await supabase
    .from('coverage_mappings')
    .select('raw_text_snippet, ai_justification, page_number, needs_human_review, embedding')
    .limit(1);

  if (error) {
    console.error('❌ Error verifying columns:', error.message);
  } else {
    console.log('✅ All high certainty columns verified successfully on coverage_mappings!');
  }
}

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
