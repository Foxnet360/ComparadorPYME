const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.');
  console.error('Definilas en .env.local o en el entorno antes de ejecutar este script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  try {
    console.log('🔍 Verifying migration...');

    // Check if table exists
    const { data, error } = await supabase.from('clause_chunks').select('*').limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('❌ Table clause_chunks NOT FOUND');
        process.exit(1);
      } else {
        console.log('⚠️ Error querying table:', error.message);
        process.exit(1);
      }
    }

    console.log('✅ Table clause_chunks exists!');

    // Check function
    const { error: funcError } = await supabase.rpc('match_clauses', {
      query_embedding: Array(768).fill(0),
      query_text: 'test',
      match_count: 1,
    });

    if (funcError && funcError.message.includes('does not exist')) {
      console.log('❌ Function match_clauses NOT FOUND');
      process.exit(1);
    } else {
      console.log('✅ Function match_clauses exists');
    }

    console.log('\n✅ Migration verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

verify();
