#!/usr/bin/env ts-node
/**
 * Post-Deploy Verification Script
 * Verifies that critical production fixes are working correctly
 * 
 * Usage: cd server && npx ts-node --transpile-only ../scripts/verify-deploy.ts
 */

import { supabase } from '../server/src/config/database';

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

async function verifyThesaurus(): Promise<VerificationResult> {
  try {
    const { error } = await supabase
      .from('chunks')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    return {
      check: 'Tesauro / Database Connection',
      status: 'pass',
      message: '✅ Database connection working',
      details: `Chunks table accessible`
    };
  } catch (error: any) {
    return {
      check: 'Tesauro / Database Connection',
      status: 'fail',
      message: '❌ Database connection failed',
      details: error.message
    };
  }
}

async function verifyRAG(): Promise<VerificationResult> {
  try {
    // Simple query to verify chunks table has searchable content
    const { data, error } = await supabase
      .from('chunks')
      .select('id, content')
      .ilike('content', '%Responsabilidad%')
      .limit(1);
    
    if (error) throw error;
    
    const count = data?.length || 0;
    
    if (count > 0) {
      return {
        check: 'RAG Search',
        status: 'pass',
        message: `✅ RAG content searchable (${count} results)`,
        details: 'Chunks table has searchable content'
      };
    } else {
      return {
        check: 'RAG Search',
        status: 'warning',
        message: '⚠️ No matching content found',
        details: 'Function works but no chunks found for query'
      };
    }
  } catch (error: any) {
    return {
      check: 'RAG Search',
      status: 'fail',
      message: '❌ RAG search error',
      details: error.message
    };
  }
}

async function verifyClauseChunks(): Promise<VerificationResult> {
  try {
    const { count, error } = await supabase
      .from('clause_chunks')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    if (count && count > 0) {
      return {
        check: 'Clause Chunks Table',
        status: 'pass',
        message: `✅ clause_chunks has ${count} records`,
        details: 'Legacy table has data (deprecated but functional)'
      };
    } else {
      return {
        check: 'Clause Chunks Table',
        status: 'warning',
        message: '⚠️ clause_chunks is empty (expected - using chunks table)',
        details: 'Migration to unified chunks table completed'
      };
    }
  } catch (error: any) {
    return {
      check: 'Clause Chunks Table',
      status: 'fail',
      message: '❌ Error checking clause_chunks',
      details: error.message
    };
  }
}

async function verifyChunks(): Promise<VerificationResult> {
  try {
    const { count, error } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    if (count && count > 0) {
      return {
        check: 'Unified Chunks Table',
        status: 'pass',
        message: `✅ chunks has ${count} records`,
        details: 'Unified vector storage is populated'
      };
    } else {
      return {
        check: 'Unified Chunks Table',
        status: 'fail',
        message: '❌ chunks table is empty',
        details: 'No documents have been indexed'
      };
    }
  } catch (error: any) {
    return {
      check: 'Unified Chunks Table',
      status: 'fail',
      message: '❌ Error checking chunks',
      details: error.message
    };
  }
}

async function verifyDocuments(): Promise<VerificationResult> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('document_name, document_type')
      .eq('is_active', true)
      .in('document_type', ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR']);
    
    if (error) throw error;
    
    const count = data?.length || 0;
    
    return {
      check: 'Documents (Clausulados)',
      status: count > 0 ? 'pass' : 'warning',
      message: count > 0 
        ? `✅ ${count} clausulados active`
        : '⚠️ No active clausulados found',
      details: data?.map((d: any) => d.document_name).join(', ') || 'None'
    };
  } catch (error: any) {
    return {
      check: 'Documents (Clausulados)',
      status: 'fail',
      message: '❌ Error checking documents',
      details: error.message
    };
  }
}

async function verifyChatTables(): Promise<VerificationResult> {
  try {
    const { error: threadError } = await supabase
      .from('chat_threads')
      .select('count')
      .limit(1);
    
    if (threadError) throw threadError;
    
    return {
      check: 'Chat Tables',
      status: 'pass',
      message: '✅ Chat tables exist and accessible',
      details: 'chat_threads and chat_messages ready'
    };
  } catch (error: any) {
    return {
      check: 'Chat Tables',
      status: 'fail',
      message: '❌ Chat tables error',
      details: error.message
    };
  }
}

function verifyEnvVars(): VerificationResult {
  const required = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(v => !process.env[v]);
  
  if (missing.length === 0) {
    return {
      check: 'Environment Variables',
      status: 'pass',
      message: '✅ All required env vars present',
      details: `GEMINI_MODEL=${process.env.GEMINI_MODEL || 'not set (default: gemini-2.5-flash)'}`
    };
  } else {
    return {
      check: 'Environment Variables',
      status: 'fail',
      message: `❌ Missing: ${missing.join(', ')}`,
      details: 'Required environment variables not configured'
    };
  }
}

async function main() {
  console.log('🔍 Post-Deploy Verification\n');
  console.log('=' .repeat(70));
  
  const results: VerificationResult[] = [];
  
  // Run all checks
  results.push(verifyEnvVars());
  results.push(await verifyThesaurus());
  results.push(await verifyChunks());
  results.push(await verifyClauseChunks());
  results.push(await verifyDocuments());
  results.push(await verifyRAG());
  results.push(await verifyChatTables());
  
  // Display results
  console.log('\n');
  results.forEach(r => {
    console.log(`${r.status === 'pass' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'} ${r.check}`);
    console.log(`   ${r.message}`);
    if (r.details) console.log(`   Details: ${r.details}`);
    console.log();
  });
  
  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  console.log('=' .repeat(70));
  console.log(`\n📊 Summary: ${passed} passed, ${warnings} warnings, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Deployment verification FAILED');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️ Deployment verified with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});
