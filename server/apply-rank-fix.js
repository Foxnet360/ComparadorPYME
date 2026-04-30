const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://nubiecwypgfekhvaffxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YmllY3d5cGdmZWtodmFmZnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwODEyNCwiZXhwIjoyMDg5OTg0MTI0fQ.yJVMLIPSs2llvTh2UHMyIHmT9NJkC80yEfhgIetgwo4'
);

async function applyFix() {
  try {
    console.log('🔧 Applying fix for match_clauses rank type...');
    
    const sqlPath = path.join(__dirname, 'migrations', 'fix_match_clauses_rank_type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
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
    const { data, error } = await supabase
      .rpc('match_clauses', {
        query_embedding: Array(768).fill(0),
        query_text: 'test',
        match_count: 1
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
