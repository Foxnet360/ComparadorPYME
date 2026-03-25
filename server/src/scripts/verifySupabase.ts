#!/usr/bin/env node
/**
 * Script para verificar la conexión y configuración de Supabase
 * Ejecutar: npx ts-node src/scripts/verifySupabase.ts
 */

import { supabase } from '../config/database';
import { embeddingService } from '../services/vector/embeddingService';

async function verifyConnection() {
  console.log('🔍 Verificando conexión a Supabase...\n');

  try {
    // 1. Verificar conexión básica
    console.log('1️⃣  Conexión a base de datos...');
    const { data: insurers, error: insurersError } = await supabase
      .from('insurers')
      .select('count')
      .limit(1);

    if (insurersError) {
      console.error('   ❌ Error:', insurersError.message);
      return false;
    }
    console.log('   ✅ Conexión exitosa');

    // 2. Verificar extensión pgvector
    console.log('\n2️⃣  Extensión pgvector...');
    const { data: vectorData, error: vectorError } = await supabase.rpc('search_chunks_by_coverage', {
      p_embedding: Array(768).fill(0),
      p_insurer_id: '00000000-0000-0000-0000-000000000000',
      p_coverage_tag: null,
      p_match_count: 1
    });

    if (vectorError && !vectorError.message.includes('insurer')) {
      console.error('   ❌ Error:', vectorError.message);
      return false;
    }
    console.log('   ✅ Funciones vectoriales listas');

    // 3. Verificar Storage
    console.log('\n3️⃣  Storage (clause-pages)...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('   ❌ Error:', bucketError.message);
      return false;
    }

    const clauseBucket = buckets?.find(b => b.name === 'clause-pages');
    if (!clauseBucket) {
      console.warn('   ⚠️  Bucket no encontrado');
      console.log('   ℹ️  Ejecuta: npx ts-node src/scripts/setupSupabase.ts');
    } else {
      console.log('   ✅ Bucket listo');
    }

    // 4. Verificar Gemini Embeddings
    console.log('\n4️⃣  API de Gemini Embeddings...');
    try {
      const testEmbedding = await embeddingService.generateEmbedding('test de conexión');
      if (testEmbedding.length === 768) {
        console.log('   ✅ Embeddings funcionando (dimensión: 768)');
      } else {
        console.warn(`   ⚠️  Dimensión inesperada: ${testEmbedding.length}`);
      }
    } catch (embeddingError) {
      console.error('   ❌ Error:', embeddingError);
      return false;
    }

    // 5. Verificar tesauro
    console.log('\n5️⃣  Tesauro...');
    try {
      const { thesaurusService } = await import('../services/normalization/thesaurusService');
      const coberturas = thesaurusService.listCoberturas();
      console.log(`   ✅ Tesauro cargado (${coberturas.length} coberturas)`);
      console.log(`   📚 Ejemplo: ${coberturas.slice(0, 3).join(', ')}...`);
    } catch (thesaurusError) {
      console.error('   ❌ Error cargando tesauro:', thesaurusError);
      return false;
    }

    console.log('\n✅ Todas las verificaciones pasaron!');
    console.log('\nEl sistema está listo para usar.');
    return true;

  } catch (error) {
    console.error('\n❌ Error durante verificación:', error);
    return false;
  }
}

verifyConnection().then(success => {
  process.exit(success ? 0 : 1);
});
