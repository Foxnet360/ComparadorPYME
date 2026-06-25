/**
 * Centralized environment variable configuration
 * Validates required variables and provides type-safe access
 */

import logger from './logger';
import { loadDomainJson } from '../services/domainBundleLoader';

export interface EnvConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_JWT_SECRET: string;
  
  // Gemini
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  GEMINI_CHAT_MODEL: string;
  GEMINI_CLAUSE_MODEL: string;
  GEMINI_EMBEDDING_MODEL: string;
  
  // Regional
  REGION: string;
  SMMLV_VALUE: number;
  UVT_VALUE: number;
  CURRENCY: string;
  
  // Storage
  CLAUSE_PAGES_BUCKET: string;
  
  // Document Processing
  MAX_FILE_SIZE: number;
  MAX_PAGES_LIMIT: number;
  UPLOAD_TIMEOUT: number;
  
  // Logging
  LOG_LEVEL: string;
  
  // Redis
  REDIS_URL?: string;
  
  // Frontend (Vite)
  VITE_GEMINI_API_KEY?: string;
}

const requiredVars = [
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

interface TaxonomyMetadata {
  salaryValue2024?: number;
  uvtValue2024?: number;
  source?: string;
}

function isWithinDrift(a: number, b: number, threshold = 0.01): boolean {
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= threshold;
}

/**
 * Compare runtime env SMMLV/UVT values with the offline taxonomy metadata.
 * Warns when the drift exceeds 1%. Throws only when both env and taxonomy are
 * missing, which should never happen because env has documented defaults.
 */
export function checkEnvTaxonomyConsistency(config: EnvConfig): void {
  let metadata: TaxonomyMetadata | undefined;

  try {
    const taxonomy = loadDomainJson<{ metadata: TaxonomyMetadata }>('pyme', 'taxonomy.json');
    metadata = taxonomy.metadata;
  } catch (error: any) {
    logger.warn(`⚠️ Could not load taxonomy metadata for consistency check: ${error.message}`);
  }

  const envSmmlv = process.env.SMMLV_VALUE;
  const envUvt = process.env.UVT_VALUE;

  if (!envSmmlv && metadata?.salaryValue2024) {
    logger.warn(`⚠️ SMMLV_VALUE not set; using taxonomy metadata ${metadata.salaryValue2024}. Source: ${metadata.source || 'unknown'}`);
  }
  if (!envUvt && metadata?.uvtValue2024) {
    logger.warn(`⚠️ UVT_VALUE not set; using taxonomy metadata ${metadata.uvtValue2024}. Source: ${metadata.source || 'unknown'}`);
  }

  if (!envSmmlv && !metadata?.salaryValue2024) {
    throw new Error('SMMLV_VALUE is not configured and taxonomy metadata is missing');
  }
  if (!envUvt && !metadata?.uvtValue2024) {
    throw new Error('UVT_VALUE is not configured and taxonomy metadata is missing');
  }

  if (metadata?.salaryValue2024 && !isWithinDrift(config.SMMLV_VALUE, metadata.salaryValue2024)) {
    logger.warn(
      `⚠️ SMMLV_VALUE (${config.SMMLV_VALUE}) differs from taxonomy metadata (${metadata.salaryValue2024}) by more than 1%. Source: ${metadata.source || 'unknown'}`
    );
  }

  if (metadata?.uvtValue2024 && !isWithinDrift(config.UVT_VALUE, metadata.uvtValue2024)) {
    logger.warn(
      `⚠️ UVT_VALUE (${config.UVT_VALUE}) differs from taxonomy metadata (${metadata.uvtValue2024}) by more than 1%. Source: ${metadata.source || 'unknown'}`
    );
  }
}

function validateEnv(): EnvConfig {
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach(v => {
      const descriptions: Record<string, string> = {
        'GEMINI_API_KEY': 'Required for AI processing. Get yours at: https://aistudio.google.com/app/apikey',
        'SUPABASE_URL': 'Required for database and vector storage. Format: https://your-project.supabase.co',
        'SUPABASE_ANON_KEY': 'Required for database access. Get yours at: https://supabase.com/dashboard',
      };
      logger.error(`   - ${v}: ${descriptions[v] || 'Required configuration'}`);
    });
    logger.error('Please set these variables in your .env file or environment.');
    logger.error('See .env.example for a template.');

    if (process.env.NODE_ENV === 'test') {
      logger.warn('⚠️ Skipping process.exit because NODE_ENV is test');
    } else {
      process.exit(1);
    }
  }
  
  const config: EnvConfig = {
    PORT: parseInt(process.env.PORT || '8080', 10),
    NODE_ENV: (process.env.NODE_ENV || 'development') as EnvConfig['NODE_ENV'],
    
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: process.env.GEMINI_CLAUSE_MODEL || 'gemini-3.5-flash',
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    
    REGION: process.env.REGION || 'CO',
    SMMLV_VALUE: parseInt(process.env.SMMLV_VALUE || '1423500', 10),
    UVT_VALUE: parseInt(process.env.UVT_VALUE || '42412', 10),
    CURRENCY: process.env.CURRENCY || 'COP',
    
    CLAUSE_PAGES_BUCKET: process.env.CLAUSE_PAGES_BUCKET || 'clause-pages',
    
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    MAX_PAGES_LIMIT: parseInt(process.env.MAX_PAGES_LIMIT || '100', 10),
    UPLOAD_TIMEOUT: parseInt(process.env.UPLOAD_TIMEOUT || '300000', 10),
    
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    
    REDIS_URL: process.env.REDIS_URL,
    VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY,
  };
  
  // Log loaded configuration (without secrets)
  logger.info('✅ Environment configuration loaded successfully');
  logger.info(`   PORT: ${config.PORT}`);
  logger.info(`   NODE_ENV: ${config.NODE_ENV}`);
  logger.info(`   GEMINI_MODEL: ${config.GEMINI_MODEL}`);
  logger.info(`   REGION: ${config.REGION}`);
  logger.info(`   CURRENCY: ${config.CURRENCY}`);
  logger.info(`   REDIS_URL: ${config.REDIS_URL ? 'configured' : 'not configured'}`);

  checkEnvTaxonomyConsistency(config);

  return config;
}

export const env = validateEnv();

// Also export individual values for convenience
export const {
  PORT,
  NODE_ENV,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  GEMINI_API_KEY,
  SMMLV_VALUE,
  UVT_VALUE,
} = env;
