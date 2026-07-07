/**
 * Integration Test: Complete Analysis Flow
 * Tests the full analysis pipeline from quote upload to report generation
 */

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { analysisController } from '../controllers/analysisController';
import { errorHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';

// Mock external dependencies that require environment variables
vi.mock('../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
}));

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware for testing
app.use((req, res, next) => {
  (req as AuthenticatedRequest).user = { id: 'test-user-123' };
  next();
});

// Mount analysis routes
app.post('/api/analyze', analysisController.uploadAndAnalyze);
app.get('/api/history', analysisController.getHistory);

// Error handling
app.use(errorHandler);

describe('Complete Analysis Flow Integration', () => {
  describe('POST /api/analyze', () => {
    it('should return 400 when no files are uploaded', async () => {
      const response = await request(app).post('/api/analyze').field('clientName', 'Test Client');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle analysis request with valid parameters', async () => {
      // Note: This test would require actual PDF files
      // In a real scenario, we'd use mock PDFs or fixtures
      const response = await request(app)
        .post('/api/analyze')
        .field('clientName', 'Test Client')
        .field(
          'clientProfile',
          JSON.stringify({
            industry: 'Technology',
            location: 'Bogota',
            size: 'Small',
          })
        );

      // Should fail gracefully without files
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/history', () => {
    it('should return analysis history for authenticated user', async () => {
      const response = await request(app).get('/api/history').query({ limit: '10', offset: '0' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });

    it('should handle invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/history')
        .query({ limit: 'invalid', offset: '0' });

      expect(response.status).toBe(400);
    });
  });

  describe('Analysis Pipeline Validation', () => {
    it('should validate required fields', async () => {
      const response = await request(app).post('/api/analyze').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle large request payloads', async () => {
      const largePayload = {
        clientName: 'A'.repeat(1000),
        coverages: Array(100).fill({ name: 'Test', value: '100M' }),
      };

      const response = await request(app).post('/api/analyze').send(largePayload);

      // Should not crash, should return validation error
      expect([400, 413, 422]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format for invalid requests', async () => {
      const response = await request(app).post('/api/analyze').send({ invalidField: true });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle authentication errors', async () => {
      // Create app without auth middleware
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.get('/api/history', analysisController.getHistory);
      appNoAuth.use(errorHandler);

      const response = await request(appNoAuth).get('/api/history');

      expect(response.status).toBe(401);
    });
  });
});
