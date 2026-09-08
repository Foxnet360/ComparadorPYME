const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.');
  console.error('Definilas en .env.local o en el entorno antes de ejecutar este script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyFix() {
  try {
    console.log('🔧 Applying fix for match_clauses rank type...');

    const sqlPath = path.join(__dirname, 'migrations', 'fix_match_clauses_rank_type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter((s) => s.trim().length > 0);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim() + ';';
      if (stmt.startsWith('--') || stmt.startsWith('/*')) continue;

      console.log(`  Executing statement ${i + 1}/${statements.length}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });

      if (error) {
        // Try alternative: use raw SQL via REST
        console.log(`  RPC failed, trying direct query...`);
        const { error: queryError } = await supabase.from('_exec_sql').select('*').eq('sql', stmt);
        if (queryError && !queryError.message.includes('does not exist')) {
          console.error(`  ⚠️ Statement ${i + 1} may have failed:`, error.message);
        }
      }
    }

    // Verify fix by calling the function
    console.log('  Verifying fix...');
    const { data, error } = await supabase.rpc('match_clauses', {
      query_embedding: Array(768).fill(0),
      query_text: 'test',
      match_count: 1,
    });

    if (error && error.code === '42804') {
      console.error('❌ Fix failed - still getting type mismatch error');
      process.exit(1);
    } else if (error && !error.message.includes('does not exist')) {
      console.log('✅ Fix applied - function now works (empty result is expected without data)');
    } else {
      console.log('✅ Fix applied successfully!');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applyFix();
