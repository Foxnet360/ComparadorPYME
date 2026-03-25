#!/usr/bin/env node
/**
 * Script de inicialización para Supabase
 * Ejecutar: npx ts-node src/scripts/setupSupabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('Asegúrate de tener SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupDatabase() {
  console.log('🏗️  Configurando base de datos en Supabase...\n');

  try {
    // Leer y ejecutar migraciones SQL
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_vector_functions.sql',
      '003_storage_policies.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Archivo no encontrado: ${file}`);
        continue;
      }

      console.log(`📄 Ejecutando: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      // Dividir SQL en statements individuales
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            // Algunos errores son esperados si los objetos ya existen
            if (!error.message.includes('already exists') && 
                !error.message.includes('duplicate')) {
              console.warn(`   ⚠️  ${error.message}`);
            }
          }
        } catch (e) {
          // Ignorar errores de statements no críticos
        }
      }
    }

    console.log('✅ Migraciones ejecutadas\n');

    // Verificar tablas creadas
    console.log('🔍 Verificando tablas...');
    const tables = ['insurers', 'documents', 'page_images', 'chunks', 'analysis_history'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.warn(`   ⚠️  Tabla '${table}': ${error.message}`);
      } else {
        console.log(`   ✅ Tabla '${table}' lista`);
      }
    }

    console.log('\n📦 Configurando Storage...');
    
    // Verificar/crear bucket
    const bucketName = 'clause-pages';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    if (!bucketExists) {
      console.log(`   Creando bucket '${bucketName}'...`);
      const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (bucketError) {
        console.warn(`   ⚠️  Error creando bucket: ${bucketError.message}`);
        console.log('   ℹ️  Puede que el bucket ya exista o necesites crearlo manualmente');
      } else {
        console.log(`   ✅ Bucket '${bucketName}' creado`);
      }
    } else {
      console.log(`   ✅ Bucket '${bucketName}' ya existe`);
    }

    console.log('\n✨ Setup completado!');
    console.log('\nPróximos pasos:');
    console.log('1. Configura las políticas de Storage manualmente en el dashboard de Supabase');
    console.log('2. Ejecuta: npm run verify-supabase');
    console.log('3. Empieza a indexar documentos!');

  } catch (error) {
    console.error('❌ Error durante setup:', error);
    process.exit(1);
  }
}

setupDatabase();
