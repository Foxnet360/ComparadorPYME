#!/usr/bin/env ts-node
/**
 * Test script for deductible regex normalization
 * Tests various real-world deductible formats from Colombian insurers
 */

import { normalizeDeductible } from '../server/src/services/thesaurusMapper';

interface TestCase {
  input: string;
  expectedNormalized: string;
  expectedNeedsReview: boolean;
  description: string;
}

const testCases: TestCase[] = [
  // MAPFRE examples
  {
    input: '10 % PERD Min 1 (SMMLV)',
    expectedNormalized: '10% PERD Min 1 (SMMLV)',
    expectedNeedsReview: false,
    description: 'MAPFRE: Percentage with space, PERD, Min, SMMLV',
  },
  {
    input: '10% PERD Min 1 SMMLV',
    expectedNormalized: '10% PERD Min 1 SMMLV',
    expectedNeedsReview: false,
    description: 'MAPFRE: Percentage without space',
  },
  {
    input: 'Sin deducible',
    expectedNormalized: 'Sin deducible',
    expectedNeedsReview: false,
    description: 'No deductible explicitly stated',
  },
  {
    input: '15% PERD Min 2 SMMLV Max 50 SMMLV',
    expectedNormalized: '15% PERD Min 2 SMMLV Max 50 SMMLV',
    expectedNeedsReview: false,
    description: 'Complex: percentage + min + max',
  },
  // SBS examples
  {
    input: '5% / Mín. 2 SMMLV (aplica sobre pérdida)',
    expectedNormalized: '5% / Mín. 2 SMMLV (aplica sobre pérdida)',
    expectedNeedsReview: false,
    description: 'SBS: Percentage with context',
  },
  {
    input: 'No aplica',
    expectedNormalized: 'No aplica',
    expectedNeedsReview: false,
    description: 'No deductible',
  },
  // HDI examples
  {
    input: '10%',
    expectedNormalized: '10%',
    expectedNeedsReview: false,
    description: 'Simple percentage',
  },
  {
    input: 'APLICA',
    expectedNormalized: 'Aplica',
    expectedNeedsReview: false,
    description: 'Deductible applies',
  },
  // AXA examples
  {
    input: '5 SMMLV',
    expectedNormalized: '5 SMMLV',
    expectedNeedsReview: false,
    description: 'Fixed SMMLV amount',
  },
  {
    input: '$500,000',
    expectedNormalized: '$500000',
    expectedNeedsReview: false,
    description: 'Fixed COP amount',
  },
  // Edge cases
  {
    input: '',
    expectedNormalized: 'No aplica',
    expectedNeedsReview: false,
    description: 'Empty string',
  },
  {
    input: 'Incluido',
    expectedNormalized: 'Incluido',
    expectedNeedsReview: false,
    description: 'Included in coverage',
  },
  {
    input: '12,5%',
    expectedNormalized: '12,5%',
    expectedNeedsReview: false,
    description: 'Decimal percentage',
  },
];

let passed = 0;
let failed = 0;

console.log('🧪 Testing Deductible Normalization\n');
console.log('='.repeat(80));

for (const test of testCases) {
  const result = normalizeDeductible(test.input);
  const pass = result.normalized === test.expectedNormalized && result.needsReview === test.expectedNeedsReview;
  
  if (pass) {
    passed++;
    console.log(`✅ PASS: ${test.description}`);
    console.log(`   Input:    "${test.input}"`);
    console.log(`   Output:   "${result.normalized}"`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${test.description}`);
    console.log(`   Input:    "${test.input}"`);
    console.log(`   Expected: "${test.expectedNormalized}" (needsReview: ${test.expectedNeedsReview})`);
    console.log(`   Got:      "${result.normalized}" (needsReview: ${result.needsReview})`);
  }
  console.log();
}

console.log('='.repeat(80));
console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
