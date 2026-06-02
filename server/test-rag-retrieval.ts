/**
 * End-to-End RAG Retrieval Test
 * Verifies that RAG retrieval returns relevant chunks for insurers with indexed clauses
 * 
 * Usage: npx ts-node test-rag-retrieval.ts
 */

import { ragRetrievalService } from './src/services/ragRetrievalService';
import { supabase } from './src/config/database';

async function testRagRetrieval() {
    console.log('🧪 RAG Retrieval End-to-End Test');
    console.log('=====================================\n');
    
    // Test 1: List insurers with indexed clauses
    console.log('📋 Test 1: Checking insurers with indexed clauses...');
    const { data: insurers, error } = await supabase
        .from('insurers')
        .select('name')
        .order('name');
    
    if (error) {
        console.error('❌ Failed to fetch insurers:', error);
        return;
    }
    
    console.log(`   Found ${insurers?.length || 0} insurers in database`);
    
    // Test 2: Check which insurers have clauses
    console.log('\n📋 Test 2: Checking clause availability...');
    const insurersWithClauses: string[] = [];
    
    for (const insurer of (insurers as any[]) || []) {
        const hasClauses = await ragRetrievalService.checkInsurerHasClauses(insurer.name);
        if (hasClauses) {
            insurersWithClauses.push(insurer.name);
            console.log(`   ✅ ${insurer.name}: Has clauses`);
        } else {
            console.log(`   ❌ ${insurer.name}: No clauses found`);
        }
    }
    
    if (insurersWithClauses.length === 0) {
        console.error('\n❌ No insurers have indexed clauses. Test cannot continue.');
        return;
    }
    
    // Test 3: Hybrid search for critical coverages
    console.log('\n📋 Test 3: Testing hybrid search for critical coverages...');
    const testQueries = [
        { coverage: 'Incendio', insurer: insurersWithClauses[0] },
        { coverage: 'Responsabilidad Civil', insurer: insurersWithClauses[0] },
        { coverage: 'Sustracción', insurer: insurersWithClauses[insurersWithClauses.length > 1 ? 1 : 0] }
    ];
    
    for (const test of testQueries) {
        console.log(`\n   Testing: ${test.coverage} for ${test.insurer}`);
        
        const results = await ragRetrievalService.search(test.coverage, {
            insurerName: test.insurer,
            coverageTags: [test.coverage.toLowerCase()],
            limit: 5
        });
        
        if (results.length === 0) {
            console.log(`   ⚠️  No chunks returned for ${test.coverage}`);
        } else {
            console.log(`   ✅ Found ${results.length} chunks`);
            console.log(`      Similarity range: ${Math.min(...results.map(r => r.similarity)).toFixed(3)} - ${Math.max(...results.map(r => r.similarity)).toFixed(3)}`);
            console.log(`      Top result: "${results[0].content.substring(0, 100)}..."`);
        }
    }
    
    // Test 4: Vector-only search
    console.log('\n📋 Test 4: Testing vector-only search...');
    const vectorResults = await ragRetrievalService.vectorSearch('deducible incendio', {
        insurerName: insurersWithClauses[0],
        limit: 5
    });
    
    console.log(`   Found ${vectorResults.length} chunks via vector search`);
    if (vectorResults.length > 0) {
        console.log(`   Avg similarity: ${(vectorResults.reduce((sum, r) => sum + r.similarity, 0) / vectorResults.length).toFixed(3)}`);
    }
    
    // Test 5: Coverage-based search
    console.log('\n📋 Test 5: Testing coverage-based search...');
    const coverageResults = await ragRetrievalService.getByCoverage('Incendio', {
        insurerName: insurersWithClauses[0],
        limit: 3
    });
    
    console.log(`   Found ${coverageResults.length} chunks for coverage search`);
    
    // Test 6: Verify name normalization
    console.log('\n📋 Test 6: Testing name normalization...');
    const { insurerNameNormalizer } = await import('./src/services/insurerNameNormalizer');
    
    const testNames = [
        'SBS SEGUROS COLOMBIA S.A.',
        'AXA COLPATRIA',
        'BBVA SEGUROS'
    ];
    
    for (const name of testNames) {
        const normalized = insurerNameNormalizer.normalize(name);
        console.log(`   "${name}" → "${normalized}"`);
    }
    
    console.log('\n=====================================');
    console.log('✅ RAG Retrieval Tests Complete');
}

// Run tests if called directly
if (require.main === module) {
    testRagRetrieval().catch(console.error);
}

export { testRagRetrieval };
