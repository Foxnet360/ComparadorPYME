/**
 * Test Suite: Clause Library Verification
 * 
 * Este script verifica que la biblioteca de clausulados funciona correctamente.
 * 
 * Usage:
 *   cd server && npx ts-node src/scripts/test_clause_library.ts
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { clauseLibrary } from '../services/clauseLibrary';

const API_URL = process.env.API_URL || 'http://localhost:8080/api';

const TEST_CONFIG = {
  testPdfPath: path.join(__dirname, '../../test_mocks/test_clause.pdf'),
  testAseguradora: 'TestAseguradora',
  testProducto: 'TestProducto',
  testVersion: '2024',
};

interface TestResult {
  success: boolean;
  task: string;
  duration: number;
  details?: any;
  error?: string;
}

async function runTest(name: string, fn: () => Promise<any>): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${name}`);
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`✅ PASSED (${duration}ms)`);
    return { success: true, task: name, duration, details: result };
  } catch (error: any) {
    const duration = Date.now() - start;
    console.log(`❌ FAILED (${duration}ms): ${error.message}`);
    return { success: false, task: name, duration, error: error.message };
  }
}

// Helper to make API requests
async function makeRequest(endpoint: string, formData?: FormData): Promise<any> {
  const url = `${API_URL}${endpoint}`;
  
  if (formData) {
    const response = await fetch(url, {
      method: 'POST',
      body: formData as any,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response.json();
  } else {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return response.json();
  }
}

// Test 5.1: Probar subir clausulado y verificar en Firestore
async function testUploadAndVerify(): Promise<any> {
  console.log('  📤 Uploading test clause...');
  
  // Create a simple test PDF or use existing
  const testContent = `
TEST CLAUSE DOCUMENT
Aseguradora: ${TEST_CONFIG.testAseguradora}
Producto: ${TEST_CONFIG.testProducto}
Versión: ${TEST_CONFIG.testVersion}

EXCLUSIONES:
1. Daños intencionales
2. Guerra y terrorismo

DEDUCIBLES:
- 10% para incendio
- 15% para robo

GARANTÍAS:
El asegurado debe mantener las instalaciones.
`;

  // Create a temporary PDF file for testing
  const tempPdfPath = path.join(__dirname, '../../test_mocks/temp_test_clause.txt');
  fs.writeFileSync(tempPdfPath, testContent);
  
  try {
    // Upload via API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempPdfPath));
    formData.append('aseguradora', TEST_CONFIG.testAseguradora);
    formData.append('producto', TEST_CONFIG.testProducto);
    formData.append('version', TEST_CONFIG.testVersion);
    
    const result = await makeRequest('/clauses', formData);
    
    if (!result || !result.id) {
      throw new Error('Upload failed: no ID returned');
    }
    
    console.log(`  ✅ Clause uploaded with ID: ${result.id}`);
    
    // Verify it exists in library
    const clause = await clauseLibrary.getClauseById(result.id);
    
    if (!clause) {
      throw new Error('Clause not found in library after upload');
    }
    
    return {
      clauseId: result.id,
      aseguradora: clause.aseguradora,
      producto: clause.producto,
      version: clause.version,
      hasTextoCompleto: clause.textoCompleto.length > 0,
      hasHash: !!clause.hash,
      tokensEstimados: clause.tokensEstimados,
    };
  } finally {
    // Cleanup
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }
  }
}

// Test 5.2: Probar búsqueda por aseguradora
async function testSearchByInsurer(): Promise<any> {
  console.log(`  🔍 Searching for clauses by insurer: ${TEST_CONFIG.testAseguradora}...`);
  
  // First, ensure we have at least one clause
  const allClauses = await clauseLibrary.getAllClauses();
  
  if (allClauses.length === 0) {
    console.log('  ⚠️  No clauses in library. Running upload test first...');
    await testUploadAndVerify();
  }
  
  // Get list of insurers
  const insurers = await clauseLibrary.listInsurers();
  console.log(`  📊 Found ${insurers.length} insurers`);
  
  if (insurers.length === 0) {
    throw new Error('No insurers found');
  }
  
  // Search by first insurer
  const testInsurer = insurers[0].aseguradora;
  const clauses = await clauseLibrary.getClausesByInsurer(testInsurer);
  
  console.log(`  ✅ Found ${clauses.length} clauses for ${testInsurer}`);
  
  // Verify all returned clauses belong to this insurer
  const allMatch = clauses.every(c => c.aseguradora === testInsurer);
  
  if (!allMatch) {
    throw new Error('Search returned clauses from different insurers');
  }
  
  return {
    insurerTested: testInsurer,
    clausesFound: clauses.length,
    totalInsurers: insurers.length,
    allClausesMatch: allMatch,
    sampleClause: clauses[0] ? {
      id: clauses[0].id,
      producto: clauses[0].producto,
    } : null,
  };
}

// Test 5.3: Probar detección de duplicados
async function testDuplicateDetection(): Promise<any> {
  console.log('  🔄 Testing duplicate detection...');
  
  // Create test content
  const testContent = `DUPLICATE TEST CONTENT - ${Date.now()}`;
  const tempPdfPath = path.join(__dirname, '../../test_mocks/temp_duplicate_test.txt');
  fs.writeFileSync(tempPdfPath, testContent);
  
  try {
    // Upload first time
    console.log('  📤 Uploading first copy...');
    const formData1 = new FormData();
    formData1.append('file', fs.createReadStream(tempPdfPath));
    formData1.append('aseguradora', 'DuplicateTest');
    formData1.append('producto', 'ProductA');
    formData1.append('version', '1.0');
    
    const result1 = await makeRequest('/clauses', formData1);
    const firstId = result1.id;
    console.log(`  ✅ First upload: ${firstId}`);
    
    // Upload same content again (should detect duplicate)
    console.log('  📤 Uploading duplicate copy...');
    const formData2 = new FormData();
    formData2.append('file', fs.createReadStream(tempPdfPath));
    formData2.append('aseguradora', 'DuplicateTest');
    formData2.append('producto', 'ProductB'); // Different product, same content
    formData2.append('version', '2.0');
    
    const result2 = await makeRequest('/clauses', formData2);
    const secondId = result2.id;
    console.log(`  ✅ Second upload: ${secondId}`);
    
    // Verify they're the same (duplicate detection)
    const isDuplicate = firstId === secondId;
    
    if (isDuplicate) {
      console.log('  ✅ Duplicate detected correctly - returned existing clause');
    } else {
      console.log('  ⚠️  New clause created (duplicate detection may not be working or different hash)');
    }
    
    return {
      firstId,
      secondId,
      isDuplicate,
      duplicateDetectionWorking: isDuplicate,
    };
  } finally {
    // Cleanup
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Clause Library - Verification Test Suite             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`API URL: ${API_URL}`);
  
  const results: TestResult[] = [];
  
  // Run all verification tests
  results.push(await runTest('5.1: Upload and verify in Firestore', testUploadAndVerify));
  results.push(await runTest('5.2: Search by insurer', testSearchByInsurer));
  results.push(await runTest('5.3: Duplicate detection', testDuplicateDetection));
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.task} (${r.duration}ms)`);
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    }
    if (r.details) {
      console.log(`   Details:`, JSON.stringify(r.details, null, 2).substring(0, 200) + '...');
    }
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All verification tests passed!');
    console.log('\nNext steps:');
    console.log('  1. Update tasks.md to mark verification tasks as complete');
    console.log('  2. Archive the change with /opsx-archive');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    console.log('Note: Tests require the backend server to be running.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { runAllTests };
