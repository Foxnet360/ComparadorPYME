/**
 * Unified OpenAPI 3.0.3 Specification Document for Comparador CSA
 * Covers both Core Platform API (/api/v1/*) and B2B DaaS API (/api/v1/daas/*).
 */

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
}

const daasHeaders = {
  'X-RateLimit-Limit': {
    schema: { type: 'integer' },
    description: 'Configured requests per minute for subscriber tier',
  },
  'X-RateLimit-Remaining': {
    schema: { type: 'integer' },
    description: 'Remaining requests in current minute window',
  },
  'X-Quota-Monthly': {
    schema: { type: 'integer' },
    description: 'Configured monthly query quota',
  },
  'X-Quota-Remaining': {
    schema: { type: 'integer' },
    description: 'Remaining queries in current monthly cycle',
  },
};

export function getUnifiedOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Comparador CSA Unified API',
      version: '1.0.0',
      description:
        'Versioned Core Platform API (/api/v1/*, with backward-compatible /api/* aliases) and B2B DaaS API (/api/v1/daas/*).',
    },
    servers: [
      { url: '/', description: 'Current deployment server' },
      { url: 'https://api.comparadorcsa.com', description: 'Production server' },
    ],
    tags: [
      { name: 'System', description: 'API metadata, health check and OpenAPI specifications' },
      { name: 'Analysis', description: 'PDF quote extraction, comparison and async jobs' },
      { name: 'Documents', description: 'Clauses library and semantic search' },
      { name: 'Portfolio', description: 'Clients, policies and renewal workflows' },
      { name: 'Analytics', description: 'Executive KPIs and conversion metrics' },
      { name: 'Webhooks', description: 'Outbound signed event webhook subscriptions' },
      { name: 'DaaS', description: 'B2B actuarial benchmarks and subscriber telemetry' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT access token for platform routes',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'B2B DaaS subscriber API key (csa_live_...)',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            traceId: { type: 'string' },
          },
          required: ['error', 'message'],
        },
        ApiEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
          required: ['success', 'data'],
        },
        SubscriberStatusData: {
          type: 'object',
          properties: {
            subscriberId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            tier: { type: 'string', enum: ['TIER_1', 'TIER_2', 'ENTERPRISE'] },
            monthlyQuota: { type: 'integer' },
            currentMonthUsage: { type: 'integer' },
            remainingQuota: { type: 'integer' },
            rateLimitPerMinute: { type: 'integer' },
            allowedDomains: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Extended service health check',
          responses: { '200': { description: 'Healthy' }, '503': { description: 'Degraded' } },
        },
      },
      '/api/v1': {
        get: {
          tags: ['System'],
          summary: 'API metadata and versioning catalog',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'API info' }, '401': { description: 'Unauthorized' } },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'Unified OpenAPI 3.0.3 specification (JSON)',
          responses: { '200': { description: 'OpenAPI JSON document' } },
        },
      },
      '/api/v1/features': {
        get: {
          tags: ['System'],
          summary: 'Active feature flags',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Feature flags' } },
        },
      },
      '/api/v1/analyze': {
        post: {
          tags: ['Analysis'],
          summary:
            'Upload and compare insurance quote PDFs (sync or async with Prefer: respond-async)',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Synchronous comparison report' },
            '202': { description: 'Async comparison job queued' },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/api/v1/history': {
        get: {
          tags: ['Analysis'],
          summary: 'List comparison history for authenticated tenant',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Comparison history list' } },
        },
      },
      '/api/v1/documents': {
        get: {
          tags: ['Documents'],
          summary: 'List indexed policy clauses',
          responses: { '200': { description: 'Document list' } },
        },
        post: {
          tags: ['Documents'],
          summary: 'Upload and index a clause PDF',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Document indexed' } },
        },
      },
      '/api/v1/search': {
        post: {
          tags: ['Documents'],
          summary: 'Semantic vector search across clauses',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Search results' } },
        },
      },
      '/api/v1/clients': {
        get: {
          tags: ['Portfolio'],
          summary: 'List tenant clients',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Client list' } },
        },
        post: {
          tags: ['Portfolio'],
          summary: 'Create client record',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Client created' } },
        },
      },
      '/api/v1/policies': {
        get: {
          tags: ['Portfolio'],
          summary: 'List tenant policies',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Policy list' } },
        },
      },
      '/api/v1/renewals': {
        get: {
          tags: ['Portfolio'],
          summary: 'List renewal lifecycle items',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Renewals list' } },
        },
      },
      '/api/v1/analytics/summary': {
        get: {
          tags: ['Analytics'],
          summary: 'Executive analytics summary with real conversion and premium totals',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Executive analytics KPIs' } },
        },
      },
      '/api/v1/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List tenant outbound webhook subscriptions',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Webhook subscriptions' } },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Create outbound webhook subscription',
          security: [{ BearerAuth: [] }],
          responses: { '201': { description: 'Subscription created' } },
        },
      },
      '/api/v1/daas/benchmarks/pricing': {
        get: {
          tags: ['DaaS'],
          summary: 'Actuarial pricing benchmark by insurance domain',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Wrapped pricing benchmark response',
              headers: daasHeaders,
            },
            '429': { description: 'Per-minute rate limit or monthly quota exceeded' },
          },
        },
      },
      '/api/v1/daas/benchmarks/market-share': {
        get: {
          tags: ['DaaS'],
          summary: 'Market share distribution by insurer',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Wrapped market share response',
              headers: daasHeaders,
            },
            '429': { description: 'Per-minute rate limit or monthly quota exceeded' },
          },
        },
      },
      '/api/v1/daas/subscriber/status': {
        get: {
          tags: ['DaaS'],
          summary: 'Current DaaS subscriber quota and per-minute rate limit status',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Wrapped subscriber status payload',
              headers: daasHeaders,
            },
          },
        },
      },
    },
  };
}
