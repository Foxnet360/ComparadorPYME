import { supabase } from '../config/database';
import { Database } from '../types/database';

type DocumentWithInsurer = Database['public']['Tables']['documents']['Row'] & {
  insurers: { name: string } | null;
};

async function diagnose() {
    console.log('🔍 INICIANDO DIAGNÓSTICO DE LA BASE DE DATOS DE SUPABASE\n');

    // 1. Catálogo de Aseguradoras
    console.log('📋 1. Catálogo de Aseguradoras en `insurers`:');
    const { data: insurers, error: insurersError } = await supabase
        .from('insurers')
        .select('*')
        .order('name');
    
    if (insurersError) {
        console.error('❌ Error al obtener aseguradoras:', insurersError);
        return;
    }
    
    console.log(`   Total aseguradoras: ${insurers?.length || 0}`);
    for (const insurer of insurers || []) {
        console.log(`   - [${insurer.id}] ${insurer.name} (NIT: ${insurer.nit || 'N/A'})`);
    }

    // 2. Documentos indexados
    console.log('\n📋 2. Documentos en `documents`:');
    const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select<string, DocumentWithInsurer>('*, insurers(name)');

    if (docsError) {
        console.error('❌ Error al obtener documentos:', docsError);
        return;
    }

    console.log(`   Total documentos: ${documents?.length || 0}`);
    for (const doc of documents || []) {
        const insurerName = doc.insurers?.name || 'Sin Aseguradora';
        console.log(`   - [${doc.id}] Nombre: "${doc.document_name}" | Tipo: ${doc.document_type} | Aseguradora: ${insurerName} | Activo: ${doc.is_active}`);
    }

    // 3. Cantidad de Chunks por Documento
    console.log('\n📋 3. Chunks en `chunks` por documento:');
    for (const doc of documents || []) {
        const { count, error: countError } = await supabase
            .from('chunks')
            .select('id', { count: 'exact', head: true })
            .eq('document_id', doc.id);
        
        if (countError) {
            console.error(`   ❌ Error al contar chunks para el documento ${doc.id}:`, countError);
        } else {
            console.log(`   - Documento "${doc.document_name}": ${count || 0} chunks`);
        }
    }

    // 4. Cantidad de Clause Chunks
    console.log('\n📋 4. Clause Chunks en `clause_chunks` (Tabla deprecated):');
    const { count: clauseChunksCount, error: clauseChunksError } = await supabase
        .from('clause_chunks')
        .select('id', { count: 'exact', head: true });

    if (clauseChunksError) {
        console.log('   ⚠️ La tabla `clause_chunks` puede no existir o dar error:', clauseChunksError.message);
    } else {
        console.log(`   - Total registros en ` + '`clause_chunks`: ' + `${clauseChunksCount || 0}`);
    }
}

diagnose().catch(console.error);
