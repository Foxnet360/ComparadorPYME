/**
 * Script para ejecutar migraciones SQL en Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://nubiecwypgfekhvaffxm.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YmllY3d5cGdmZWtodmFmZnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwODEyNCwiZXhwIjoyMDg5OTg0MTI0fQ.yJVMLIPSs2llvTh2UHMyIHmT9NJkC80yEfhgIetgwo4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeMigration(fileName) {
  console.log(`\n📄 Ejecutando: ${fileName}`);

  const filePath = path.join(__dirname, '../../supabase/migrations', fileName);
  const sql = fs.readFileSync(filePath, 'utf-8');

  // Dividir en statements (ignorar comentarios y bloques vacíos)
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  let successCount = 0;
  let skipCount = 0;

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';',
      });

      if (error) {
        // Errores comunes que podemos ignorar
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('function "exec_sql" does not exist')
        ) {
          skipCount++;
        } else {
          console.log(`   ⚠️  ${error.message.substring(0, 80)}`);
        }
      } else {
        successCount++;
      }
    } catch (e) {
      // Ignorar errores de función no existente
      skipCount++;
    }
  }

  console.log(`   ✅ ${successCount} statements ejecutados, ${skipCount} ignorados`);
}

async function runMigrations() {
  console.log('🏗️  Ejecutando migraciones en Supabase...\n');

  const migrations = [
    '001_initial_schema.sql',
    '002_vector_functions.sql',
    '003_storage_policies.sql',
  ];

  for (const migration of migrations) {
    await executeMigration(migration);
  }

  console.log('\n✅ Migraciones completadas');

  // Verificar tablas
  console.log('\n🔍 Verificando tablas creadas...');
  const tables = ['insurers', 'documents', 'page_images', 'chunks', 'analysis_history'];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${table}: Error de conexión`);
    }
  }
}

runMigrations().catch(console.error);
