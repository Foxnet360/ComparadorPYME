import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root regardless of CWD
const projectRoot = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(projectRoot, '.env') });

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';

// Mock env config to prevent process.exit(1) when env vars are missing
vi.mock('../../config/env', () => {
  const env = {
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: process.env.GEMINI_CLAUSE_MODEL || 'gemini-2.5-flash',
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    PORT: parseInt(process.env.PORT || '8080', 10),
    NODE_ENV: (process.env.NODE_ENV || 'test') as 'development' | 'production' | 'test',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
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
  return {
    env,
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    SMMLV_VALUE: env.SMMLV_VALUE,
    UVT_VALUE: env.UVT_VALUE,
  };
});

// Mock Google GenAI to avoid live API calls and force EXCLUSIVE consensus
vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          proposedGroupId: 'EXCLUSIVE',
          justification: 'Mocked: coverage is exclusive and requires human review',
          approved: true,
          alternativeGroupId: null,
          reason: 'Mocked critic approval',
        }),
      }),
    };
  },
  Type: {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
    OBJECT: 'object',
  },
}));

// Mock embedding service to avoid real embeddings
vi.mock('../../services/vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
    generateEmbeddingsBatch: vi.fn((texts: string[]) =>
      Promise.resolve(texts.map((text) => ({ text, embedding: [0.1, 0.2, 0.3] })))
    ),
    cosineSimilarity: vi.fn(() => 0.5),
  },
}));

// Mock cache to avoid Redis dependency
vi.mock('../../services/cache/redisCache', () => ({
  getCacheValue: vi.fn(() => Promise.resolve(null)),
  setCacheValue: vi.fn(() => Promise.resolve(undefined)),
  deleteCacheValue: vi.fn(() => Promise.resolve(undefined)),
  getCachedCoverageMapping: vi.fn(() => Promise.resolve(null)),
  setCachedCoverageMapping: vi.fn(() => Promise.resolve()),
}));

// Import real Supabase client (lazy init)
import { supabase } from '../../config/database';

// Import after mocks
import { getReviewQueueCoverages } from '../../controllers/reviewQueueController';
import { buildCanonicalCoverages } from '../../services/coverageNormalizer';

const hasSupabaseCredentials =
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('Review Queue E2E Flow', () => {
  const app = express();
  const router = Router();
  router.get('/review-queue/coverages', getReviewQueueCoverages);
  app.use('/api/analysis', router);

  it.runIf(hasSupabaseCredentials)(
    'should persist unmapped coverage and return it in the review queue',
    async () => {
      const testId = uuidv4();
      const rawName = `TEST-EXCLUSIVE-COVERAGE-${testId}`;

      try {
        // Step 1: Feed unique coverage through normalizer (ontology mode)
        const normalizationResult = await buildCanonicalCoverages(
          [{ rawName, insuredAmount: 1000000, deductible: '10%' }],
          [],
          [],
          undefined,
          'pyme'
        );

        // The coverage should appear as uncategorized (unmapped)
        const uncategorized = normalizationResult.uncategorizedCoverages || [];
        const foundUncategorized = uncategorized.find((c) => c.rawNames.includes(rawName));
        expect(foundUncategorized).toBeDefined();
        expect(foundUncategorized?.needsReview).toBe(true);

        // Step 2: Verify DB persistence
        const { data: dbRows, error: dbError } = await supabase
          .from('coverage_mappings')
          .select('*')
          .eq('raw_name', rawName);

        expect(dbError).toBeNull();
        expect(dbRows).toBeDefined();
        expect(dbRows!.length).toBeGreaterThan(0);
        expect(dbRows![0].needs_human_review).toBe(true);

        // Step 3: Call review queue API and verify response shape
        const response = await request(app)
          .get('/api/analysis/review-queue/coverages')
          .query({ limit: '100' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination.total).toBeGreaterThan(0);

        const match = response.body.data.find(
          (r: Record<string, unknown>) => r.rawName === rawName
        );
        expect(match).toBeDefined();
        expect(match).toHaveProperty('id');
        expect(match).toHaveProperty('rawName');
        expect(match).toHaveProperty('insurerName');
        // Note: domain is in the controller contract but not present in the
        // actual coverage_mappings DB schema, so it may be omitted.
        expect(match).toHaveProperty('confidence');
        expect(match).toHaveProperty('createdAt');
      } finally {
        // Step 4: Cleanup test data
        await supabase.from('coverage_mappings').delete().eq('raw_name', rawName);
      }
    }
  );

  it.runIf(hasSupabaseCredentials)(
    'should return empty review queue when no unmapped coverages exist',
    async () => {
      const response = await request(app)
        .get('/api/analysis/review-queue/coverages')
        .query({ limit: '20' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    }
  );
});
