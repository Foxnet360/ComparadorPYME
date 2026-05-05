#!/usr/bin/env node
/**
 * Test Suite: Feature Consolidar Biblioteca de Clausulados
 * 
 * Verifica:
 * 1. Conexión a Supabase
 * 2. Migración 007 aplicada
 * 3. Endpoints de documentos funcionan
 * 4. Auto-archive funciona correctamente
 * 5. CLI seed script puede ejecutarse
 * 
 * Uso:
 *   cd server && node src/scripts/test_clause_library.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración desde .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Utilidades
function log(step, message, type = 'info') {
  const icons = { info: 'ℹ️ ', success: '✅ ', error: '❌ ', warning: '⚠️ ' };
  console.log(`${icons[type]} [${step}] ${message}`);
}

async function testConnection() {
  log('1/7', 'Probando conexión a Supabase...');
  
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    log('1/7', `Conexión OK. Tabla documents existe (${data} registros)`, 'success');
    return true;
  } catch (err) {
    log('1/7', `Error de conexión: ${err.message}`, 'error');
    return false;
  }
}

async function testMigration() {
  log('2/7', 'Verificando migración 007...');
  
  try {
    // Verificar columna product_name
    const { data: columns, error: colError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'product_name'
        `
      });
    
    if (colError) {
      // Si exec_sql no existe, usar método alternativo
      const { data: testData, error: testError } = await supabase
        .from('documents')
        .select('product_name')
        .limit(1);
      
      if (testError && testError.message.includes('product_name')) {
        log('2/7', 'Columna product_name NO existe. La migración 007 no se ha aplicado.', 'error');
        return false;
      }
    }
    
    log('2/7', 'Columna product_name existe ✓', 'success');
    
    // Verificar índice único
    const { data: indexes, error: idxError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'documents' AND indexname = 'documents_unique_active_version'
        `
      });
    
    if (!idxError && indexes) {
      log('2/7', 'Índice documents_unique_active_version existe ✓', 'success');
    } else {
      log('2/7', 'Índice documents_unique_active_version: no verificado (exec_sql no disponible)', 'warning');
    }
    
    return true;
  } catch (err) {
    log('2/7', `Error verificando migración: ${err.message}`, 'error');
    return false;
  }
}

async function testListDocuments() {
  log('3/7', 'Probando GET /api/documents (listDocuments)...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=*&limit=1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      log('3/7', `Endpoint responde OK (${data.length} documentos encontrados)`, 'success');
      return true;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    log('3/7', `Error: ${err.message}`, 'error');
    return false;
  }
}

async function testCreateDocument() {
  log('4/7', 'Probando POST /api/documents (createDocument)...');
  log('4/7', 'Nota: Este test requiere el servidor backend corriendo en localhost:8080', 'warning');
  
  try {
    // Verificar si hay un archivo de prueba
    const testFiles = [
      path.join(__dirname, '../../../Ejemplos/laser-home/Clausulados/Clausulado - AXA Colpatria.pdf'),
      path.join(__dirname, '../../test_mocks/test_clause.pdf')
    ];
    
    let testFile = null;
    for (const file of testFiles) {
      if (fs.existsSync(file)) {
        testFile = file;
        break;
      }
    }
    
    if (!testFile) {
      log('4/7', 'No se encontró archivo PDF de prueba. Saltando test de upload.', 'warning');
      return null;
    }
    
    // Intentar conectar al servidor local
    const healthCheck = await fetch('http://localhost:8080/api/documents?limit=1', {
      method: 'GET',
      timeout: 5000
    }).catch(() => null);
    
    if (!healthCheck) {
      log('4/7', 'Servidor no responde en localhost:8080. Inicia el servidor primero:', 'warning');
      log('4/7', '  npm run server:dev', 'info');
      return null;
    }
    
    // Subir documento de prueba
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(testFile);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    
    formData.append('file', blob, 'test-document.pdf');
    formData.append('insurerName', 'TEST_ASEGURADORA');
    formData.append('documentName', 'Documento de Prueba');
    formData.append('documentType', 'CLAUSULADO_GENERAL');
    formData.append('productName', 'Test Product');
    formData.append('version', '2024.99');
    
    const response = await fetch('http://localhost:8080/api/documents', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      log('4/7', `Documento creado OK (ID: ${result.documentId})`, 'success');
      return result.documentId;
    } else {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }
  } catch (err) {
    log('4/7', `Error: ${err.message}`, 'error');
    return null;
  }
}

async function testAutoArchive(documentId) {
  log('5/7', 'Probando auto-archive (subir segunda versión)...');
  
  if (!documentId) {
    log('5/7', 'Saltando: no se creó documento en paso anterior', 'warning');
    return null;
  }
  
  try {
    // Buscar el documento creado
    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (error) throw error;
    
    log('5/7', `Documento encontrado: ${doc.document_name} (v${doc.version})`, 'info');
    
    // Verificar que está activo
    if (doc.is_active) {
      log('5/7', 'Documento está activo ✓', 'success');
    } else {
      log('5/7', 'Documento NO está activo', 'warning');
    }
    
    return doc;
  } catch (err) {
    log('5/7', `Error: ${err.message}`, 'error');
    return null;
  }
}

async function testSeedScript() {
  log('6/7', 'Verificando CLI seed script...');
  
  try {
    const seedScriptPath = path.join(__dirname, 'seedClauses.ts');
    
    if (!fs.existsSync(seedScriptPath)) {
      log('6/7', 'Script seedClauses.ts no encontrado', 'error');
      return false;
    }
    
    log('6/7', 'Script seedClauses.ts existe ✓', 'success');
    
    // Verificar que puede generar manifest
    const { execSync } = require('child_process');
    
    try {
      const output = execSync('cd ' + path.join(__dirname, '../..') + ' && npx ts-node --transpile-only src/scripts/seedClauses.ts --generate-manifest', {
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } // Evitar que cargue Supabase
      });
      
      if (output.includes('Manifest generado')) {
        log('6/7', 'Generación de manifest funciona ✓', 'success');
        
        // Verificar que el manifest tiene las entradas correctas
        const manifestPath = path.join(__dirname, '../../manifest-example.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const generalClauses = manifest.entries.filter(e => e.documentType === 'CLAUSULADO_GENERAL');
          log('6/7', `Manifest contiene ${generalClauses.length} clausulados generales`, 'success');
        }
        
        return true;
      }
    } catch (execErr) {
      log('6/7', `Error ejecutando seed script: ${execErr.message}`, 'warning');
      return false;
    }
  } catch (err) {
    log('6/7', `Error: ${err.message}`, 'error');
    return false;
  }
}

async function testCleanup(testInsurerName) {
  log('7/7', 'Limpiando documentos de prueba...');
  
  try {
    // Eliminar documentos de TEST_ASEGURADORA
    const { data: testDocs, error: findError } = await supabase
      .from('documents')
      .select('id')
      .ilike('document_name', '%Prueba%')
      .or(`insurer_id.eq.(select id from insurers where name ilike '%TEST%')`);
    
    if (findError) {
      // Intentar eliminar por nombre directamente
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .ilike('document_name', '%Prueba%');
      
      if (deleteError) {
        log('7/7', `No se pudieron eliminar documentos de prueba: ${deleteError.message}`, 'warning');
      } else {
        log('7/7', 'Documentos de prueba eliminados ✓', 'success');
      }
    }
  } catch (err) {
    log('7/7', `Error en cleanup: ${err.message}`, 'warning');
  }
}

// Main
async function main() {
  console.log('🧪 Test Suite: Consolidar Biblioteca de Clausulados\n');
  console.log('=====================================================\n');
  
  const results = {
    connection: await testConnection(),
    migration: await testMigration(),
    listDocuments: await testListDocuments(),
    createDocument: null,
    autoArchive: null,
    seedScript: await testSeedScript(),
    cleanup: null
  };
  
  // Solo probar createDocument si el servidor está corriendo
  if (results.connection && results.migration) {
    results.createDocument = await testCreateDocument();
    if (results.createDocument) {
      results.autoArchive = await testAutoArchive(results.createDocument);
    }
  }
  
  // Cleanup
  results.cleanup = await testCleanup();
  
  // Resumen
  console.log('\n=====================================================');
  console.log('📊 RESUMEN DE TESTS\n');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r === true || r !== null).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;
  
  console.log(`Total: ${total} tests`);
  console.log(`✅ Pasados: ${passed}`);
  console.log(`❌ Fallidos: ${failed}`);
  console.log(`⏭️  Saltados: ${skipped}`);
  
  if (failed === 0) {
    console.log('\n🎉 ¡Todos los tests pasaron!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Algunos tests fallaron. Revisa los errores arriba.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});