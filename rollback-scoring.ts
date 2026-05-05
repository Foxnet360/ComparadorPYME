/**
 * Rollback Script
 * Reverts scoring changes to neutral (50/100) when no clause document is available
 * 
 * Usage: npm run rollback:scoring
 */

import { quoteScorer } from './server/src/services/quoteScorer';

console.log('🔄 Rollback Script: Reverting scoring penalties...');
console.log('');
console.log('This script will:');
console.log('1. Revert clause absence penalty from 30 to 50 (neutral)');
console.log('2. Disable phantom coverage penalties');
console.log('3. Disable mandatory missing coverage penalties');
console.log('');
console.log('To apply rollback:');
console.log('1. Edit server/src/services/quoteScorer.ts');
console.log('2. Change all "return 30" back to "return 50" for neutral scores');
console.log('3. Comment out penalty calculations in calculateCoverageScore');
console.log('');
console.log('⚠️  Note: This is a manual rollback. Review changes before deploying.');

// Export rollback configuration
export const ROLLBACK_CONFIG = {
  // Set to true to disable all clause-related penalties
  disableClausePenalties: false,
  
  // Neutral score when no clause document (default: 50)
  neutralScore: 50,
  
  // Phantom coverage penalty (default: 0 to disable)
  phantomPenalty: 15,
  
  // Mandatory missing penalty (default: 0 to disable)
  mandatoryMissingPenalty: 10
};

// Instructions for manual rollback
console.log('\n📋 Manual Rollback Instructions:');
console.log('1. Open server/src/services/quoteScorer.ts');
console.log('2. Find all instances of "return 30" in scoring functions');
console.log('3. Change to "return 50" for neutral behavior');
console.log('4. Comment out or remove penalty logic in calculateCoverageScore');
console.log('5. Run tests to verify scores match pre-change values');
console.log('6. Deploy when ready');
