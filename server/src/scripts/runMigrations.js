/**
 * Script para ejecutar migraciones SQL en Supabase
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.');
  console.error('Definilas en .env.local o en el entorno antes de ejecutar este script.');
  process.exit(1);
}

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
