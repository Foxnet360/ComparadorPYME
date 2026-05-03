/**
 * Script de prueba para validar matching semántico con cotizaciones reales
 * Ejecutar: npx ts-node test-matching.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

import { semanticMatcher } from './src/services/semanticMatcher';
import { formatPercentage } from './src/utils/formatCurrency';

async function testMatching() {
    console.log('🧪 Testing Semantic Matching with Real Coverage Names\n');
    
    // Nombres de coberturas típicos de cotizaciones reales
    const testCases = [
        // Variantes de Incendio
        { input: 'INCENDIO Y/O RAYO', expected: 1 },
        { input: 'Incendio Edificio', expected: 1 },
        { input: 'DAÑOS POR INCENDIO', expected: 1 },
        
        // Variantes de Responsabilidad Civil
        { input: 'RESPONSABILIDAD CIVIL', expected: 6 },
        { input: 'RC Daños a Terceros', expected: 6 },
        { input: 'Responsabilidad Civil Extracontractual', expected: 6 },
        
        // Variantes de Robo/Hurto
        { input: 'ROBO CON VIOLENCIA', expected: 3 },
        { input: 'Hurto', expected: 3 },
        { input: 'Sustracción', expected: 3 },
        
        // Variantes de Equipo Electrónico
        { input: 'EQUIPO ELECTRONICO', expected: 4 },
        { input: 'Equipo de Cómputo', expected: 4 },
        { input: 'Daños a Equipos Eléctricos', expected: 4 },
        
        // Variantes de Vidrios
        { input: 'ROTURA DE VIDRIOS', expected: 7 },
        { input: 'Vidrios y/o Cristales', expected: 7 },
        
        // Casos difíciles (para fuzzy/embedding)
        { input: 'ASISTENCIA', expected: 11 },  // Ambiguo
        { input: 'TRANSPORTE', expected: 9 },   // Ambiguo
        
        // Errores tipográficos
        { input: 'Responsaviliad Civil', expected: 6 },
        { input: 'Incendioo', expected: 1 },
        
        // Coberturas no estándar (para LLM)
        { input: 'Derrame de sustancias peligrosas', expected: null },
        { input: 'Cobertura XYZ no existe', expected: null },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = await semanticMatcher.matchCoverage(testCase.input);
        const success = result.categoryId === testCase.expected;
        
        if (success) {
            passed++;
            console.log(`✅ "${testCase.input}"`);
            console.log(`   → ${result.canonicalName} (confianza: ${formatPercentage(result.confidence, 0)}, método: ${result.method})`);
        } else {
            failed++;
            console.log(`❌ "${testCase.input}"`);
            console.log(`   Esperado: categoría ${testCase.expected}`);
            console.log(`   Obtenido: ${result.categoryId !== null ? `categoría ${result.categoryId} (${result.canonicalName})` : 'sin match'}`);
            console.log(`   Confianza: ${formatPercentage(result.confidence, 0)}, método: ${result.method}`);
        }
        console.log('');
    }
    
    console.log(`\n📊 Resultados: ${passed}/${testCases.length} pasaron (${formatPercentage(passed/testCases.length, 0)})`);
    console.log(`   ✅ ${passed} correctos`);
    console.log(`   ❌ ${failed} incorrectos`);
    
    // Performance test
    console.log('\n⏱️  Performance Test:');
    const perfTests = [
        'Incendio (Edificio y Contenidos)',
        'Responsabilidad Civil',
        'Equipo Electrónico',
        'Vidrios Planos',
        'Robo y Hurto',
        'Lucro Cesante',
        'Rotura de Maquinaria',
        'Manejo Global',
        'Transporte de Mercancías',
        'Transporte de Valores',
        'Asistencia PYME',
        'Asistencia Legal',
        'Huelga, Motín, Asonada',
        'Terremoto',
        'Daños por Agua'
    ];
    
    const start = Date.now();
    for (const name of perfTests) {
        await semanticMatcher.matchCoverage(name);
    }
    const duration = Date.now() - start;
    
    console.log(`   ${perfTests.length} coberturas procesadas en ${duration}ms`);
    console.log(`   Promedio: ${(duration/perfTests.length).toFixed(1)}ms por cobertura`);
    console.log(`   ${duration < 5000 ? '✅' : '❌'} Cumple requisito < 5 segundos`);
}

testMatching().catch(console.error);
