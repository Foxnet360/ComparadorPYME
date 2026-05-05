#!/usr/bin/env node
/**
 * Script para ejecutar la migración 007 manualmente
 * Uso: node run_migration_007.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nubiecwypgfekhvaffxm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Se requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  console.error('Ejemplo: SUPABASE_SERVICE_ROLE_KEY=eyJ... node run_migration_007.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🏗️  Ejecutando migración 007...\n');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/007_add_product_name_and_versioning.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Dividir en statements individuales
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const statement of statements) {
    const sqlStatement = statement + ';';
    console.log(`📄 Ejecutando: ${sqlStatement.substring(0, 80)}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: sqlStatement });
      
      if (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('does not exist')) {
          console.log(`   ⏭️  ${error.message}`);
          skipCount++;
        } else {
          console.error(`   ❌ ${error.message}`);
          throw error;
        }
      } else {
        console.log(`   ✅ OK`);
        successCount++;
      }
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
      throw e;
    }
  }
  
  console.log(`\n✅ Migración completada: ${successCount} ejecutados, ${skipCount} ignorados`);
  
  // Verificar
  console.log('\n🔍 Verificando...');
  const { data, error } = await supabase
    .from('documents')
    .select('product_name')
    .limit(1);
    
  if (error) {
    console.error('❌ Error verificando:', error.message);
  } else {
    console.log('✅ Columna product_name verificada correctamente');
  }
}

runMigration().catch(err => {
  console.error('\n❌ Fallo en migración:', err.message);
  process.exit(1);
});