import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno antes de requerir la base de datos
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { supabase } = require('../config/database');

const SQL_FIX = `
-- 1. Recompilar la vista document_insurer_view con JOIN correcto a insurers
CREATE OR REPLACE VIEW document_insurer_view AS
SELECT 
    d.id,
    d.document_name,
    d.document_type,
    d.version,
    d.total_pages,
    d.storage_path,
    d.is_active,
    d.created_at,
    d.updated_at,
    d.uploaded_by,
    d.file_hash,
    i.name as insurer_name,
    d.insurer_id
FROM documents d
JOIN insurers i ON d.insurer_id = i.id;
`;

async function main() {
  console.log('🏗️  Aplicando parche SQL en Supabase...');
  try {
    const { data, error } = await (supabase as any).rpc('exec_sql', { sql: SQL_FIX });
    if (error) {
      throw error;
    }
    console.log('✅ Vista document_insurer_view recompilada correctamente.');
  } catch (err: any) {
    console.error('❌ Error ejecutando parche SQL:', err.message || err);
    process.exit(1);
  }
}

main();
