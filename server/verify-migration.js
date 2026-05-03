const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nubiecwypgfekhvaffxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YmllY3d5cGdmZWtodmFmZnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwODEyNCwiZXhwIjoyMDg5OTg0MTI0fQ.yJVMLIPSs2llvTh2UHMyIHmT9NJkC80yEfhgIetgwo4'
);

async function verify() {
  try {
    console.log('🔍 Verifying migration...');
    
    // Check if table exists
    const { data, error } = await supabase
      .from('clause_chunks')
      .select('*')
      .limit(1);
    
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
    const { error: funcError } = await supabase
      .rpc('match_clauses', {
        query_embedding: Array(768).fill(0),
        query_text: 'test',
        match_count: 1
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
