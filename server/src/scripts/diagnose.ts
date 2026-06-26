#!/usr/bin/env node
/**
 * Script de diagnóstico para verificar configuración del servidor
 */

console.log('=== DIAGNÓSTICO DEL SERVIDOR ===\n');

// 1. Verificar variables de entorno
console.log('1. Variables de Entorno:');
console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurado' : '❌ No configurado');
console.log('   - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ No configurado');
console.log('   - GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Configurado' : '❌ No configurado');
console.log('   - PORT:', process.env.PORT || '8080 (default)');
console.log('   - NODE_ENV:', process.env.NODE_ENV || 'development (default)');

// 2. Verificar conectividad con Supabase
console.log('\n2. Probando conexión con Supabase...');
const testSupabase = async () => {
  try {
    const { supabase } = await import('../config/database');
    const { error } = await supabase.from('analysis_history').select('count');
    
    if (error) {
      console.log('   ❌ Error conectando a Supabase:', error.message);
      return false;
    }
    console.log('   ✅ Conexión a Supabase exitosa');
    return true;
  } catch (err: unknown) {
    console.log('   ❌ Error:', err instanceof Error ? err.message : String(err));
    return false;
  }
};

// 3. Verificar Gemini API
console.log('\n3. Probando conexión con Gemini...');
const testGemini = async () => {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('   ❌ GEMINI_API_KEY no está configurado');
      return false;
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
    
    // Intentar una generación simple
    await model.generateContent('Hola');
    console.log('   ✅ Conexión a Gemini exitosa');
    return true;
  } catch (err: unknown) {
    console.log('   ❌ Error conectando a Gemini:', err instanceof Error ? err.message : String(err));
    return false;
  }
};

// Ejecutar tests
const runDiagnostics = async () => {
  await testSupabase();
  await testGemini();
  
  console.log('\n=== FIN DEL DIAGNÓSTICO ===');
  process.exit(0);
};

runDiagnostics();
