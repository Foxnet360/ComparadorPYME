import { supabase } from '../config/database';

async function deduplicateAXA() {
  console.log('🧹 INICIANDO SANEAMIENTO Y DEDUPLICACIÓN DE AXA COLPATRIA IN DATABASE');
  console.log('=================================================================\n');

  // 1. Obtener los registros de AXA en la base de datos
  const { data: insurers, error: fetchError } = await supabase
    .from('insurers')
    .select('id, name')
    .or('name.eq."AXA Colpatria",name.eq."AXA COLPATRIA"');

  if (fetchError) {
    console.error('❌ Error al consultar las aseguradoras:', fetchError.message);
    return;
  }

  console.log(`🔍 Registros de AXA encontrados: ${insurers?.length || 0}`);
  for (const insurer of insurers || []) {
    console.log(`   - ID: ${insurer.id} | Nombre en base de datos: "${insurer.name}"`);
  }

  const officialAxa = insurers?.find((i) => i.name === 'AXA Colpatria');
  const duplicateAxa = insurers?.find((i) => i.name === 'AXA COLPATRIA');

  if (!officialAxa) {
    console.error('❌ No se encontró la aseguradora oficial "AXA Colpatria" (en minúsculas).');
    return;
  }

  if (!duplicateAxa) {
    console.log(
      '✅ No se detectó la aseguradora duplicada "AXA COLPATRIA" (en mayúsculas). No se requiere deduplicación.'
    );
    return;
  }

  console.log(
    `\n🔄 Iniciando reasociación de documentos del ID duplicado (${duplicateAxa.id}) al ID oficial (${officialAxa.id})...`
  );

  // 2. Buscar documentos asociados al duplicado
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, document_name')
    .eq('insurer_id', duplicateAxa.id);

  if (docsError) {
    console.error('❌ Error al obtener documentos del duplicado:', docsError.message);
    return;
  }

  console.log(`   Documentos a migrar: ${documents?.length || 0}`);

  if (documents && documents.length > 0) {
    for (const doc of documents) {
      console.log(`   - Migrando documento: "${doc.document_name}" (ID: ${doc.id})`);

      // Reasociar cada documento
      const { error: updateError } = await supabase
        .from('documents')
        .update({ insurer_id: officialAxa.id })
        .eq('id', doc.id);

      if (updateError) {
        console.error(
          `   ❌ Error al reasociar el documento "${doc.document_name}":`,
          updateError.message
        );
        return;
      }
      console.log(`     ✅ Reasociado exitosamente.`);
    }
  }

  // 3. Eliminar la aseguradora duplicada
  console.log(
    `\n🗑️ Eliminando aseguradora duplicada "${duplicateAxa.name}" (ID: ${duplicateAxa.id})...`
  );
  const { error: deleteError } = await supabase.from('insurers').delete().eq('id', duplicateAxa.id);

  if (deleteError) {
    console.error('❌ Error al eliminar la aseguradora duplicada:', deleteError.message);
    return;
  }

  console.log('✅ Aseguradora duplicada eliminada exitosamente.');
  console.log('\n🎉 PROCESO DE DEDUPLICACIÓN COMPLETADO CON ÉXITO.');
}

deduplicateAXA().catch(console.error);
