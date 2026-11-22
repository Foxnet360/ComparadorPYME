import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { FakeSupabase } from './helpers/fakeSupabase';
import { bearerTokenFor } from './helpers/authTokens';

const holder = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
  generateContentMock: vi.fn(async () => ({ text: '📄 Respuesta OK' })),
}));

vi.mock('../../server/src/config/database', async () => {
  const { createFakeSupabase } = await import('./helpers/fakeSupabase');
  const fakeInstance = createFakeSupabase();
  // Local test-only shim on the query builder for .or() and .upsert() so
  // multi-tenant org/user queries work without editing shared fakeSupabase.ts
  const origFrom = fakeInstance.client.from.bind(fakeInstance.client);
  (fakeInstance.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
    const builder = origFrom(table) as Record<string, unknown>;
    if (typeof builder.or !== 'function') {
      builder.or = () => builder;
    }
    if (typeof builder.upsert !== 'function') {
      builder.upsert = (row: Record<string, unknown>) => builder.insert(row);
    }
    return builder;
  };
  holder.fake = fakeInstance;
  return { supabase: fakeInstance.client };
});

vi.mock('../../server/src/services/geminiClient', () => ({
  getGenAI: () => ({
    models: {
      generateContent: holder.generateContentMock,
    },
  }),
}));

const fake = holder.fake;

import policyRoutes from '../../server/src/routes/policyRoutes';
import renewalRoutes from '../../server/src/routes/renewalRoutes';
import clientRoutes from '../../server/src/routes/clientRoutes';
import chatRoutes from '../../server/src/routes/chat';
import { authGate } from '../../server/src/middleware/authGate';
import { errorHandler } from '../../server/src/middleware/errorHandler';
import {
  searchOrgClientDirectory,
  shareClientWithUser,
  delegateClientToAdvisors,
} from '../../server/src/repositories/clientRepository';
import { processChatMessage } from '../../server/src/services/chatService';
import { chatRepository } from '../../server/src/repositories/chatRepository';
import { sanitizeUploadFieldname, validatePdfMagicBytes } from '../../server/src/middleware/upload';

const ORG_1 = '11111111-1111-4111-8111-111111111111';
const ORG_2 = '22222222-2222-4222-8222-222222222222';
const ADMIN_1 = 'admin-1-uuid';
const TECH_A = 'tech-a-uuid';
const TECH_B = 'tech-b-uuid';
const OUTSIDER = 'outsider-org2-uuid';

function tokenFor(userId: string, role: string, orgId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role,
      orgId,
      app_metadata: { role, org_id: orgId },
    })
  ).toString('base64url');
  return `Bearer ${header}.${payload}.sig`;
}

function buildApiApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/policies', policyRoutes);
  app.use('/api/renewals', renewalRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/chat', chatRoutes);
  app.use(errorHandler);
  return app;
}

describe('T3 Security Hardening (S2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.replaceRows('organization_members', [
      { id: 'm1', org_id: ORG_1, user_id: ADMIN_1, role: 'ally_admin', status: 'ACTIVE' },
      { id: 'm2', org_id: ORG_1, user_id: TECH_A, role: 'ally_technical', status: 'ACTIVE' },
      { id: 'm3', org_id: ORG_1, user_id: TECH_B, role: 'ally_technical', status: 'ACTIVE' },
      { id: 'm4', org_id: ORG_2, user_id: OUTSIDER, role: 'ally_technical', status: 'ACTIVE' },
    ]);
    fake.replaceRows('clients', [
      {
        id: 'client-a',
        user_id: ADMIN_1,
        org_id: ORG_1,
        name: 'Cliente A',
        assigned_to: TECH_A,
        lead_status: 'asignado',
      },
      {
        id: 'client-b',
        user_id: TECH_B,
        org_id: ORG_1,
        name: 'Cliente B',
        assigned_to: TECH_B,
        lead_status: 'asignado',
      },
    ]);
    fake.replaceRows('client_shares', []);
    fake.replaceRows('client_delegation_audit', []);
    fake.replaceRows('policies', [
      {
        id: 'pol-a',
        user_id: ADMIN_1,
        org_id: ORG_1,
        client_id: 'client-a',
        ramo: 'autos',
        insurer: 'SURA',
        end_date: '2027-01-01',
      },
      {
        id: 'pol-b',
        user_id: TECH_B,
        org_id: ORG_1,
        client_id: 'client-b',
        ramo: 'pyme',
        insurer: 'AXA',
        end_date: '2027-02-01',
      },
    ]);
    fake.replaceRows('renewals', [
      {
        id: 'ren-a',
        user_id: ADMIN_1,
        org_id: ORG_1,
        policy_id: 'pol-a',
        cycle_start: '2026-11-01',
        state: 'detected',
      },
      {
        id: 'ren-b',
        user_id: TECH_B,
        org_id: ORG_1,
        policy_id: 'pol-b',
        cycle_start: '2026-11-01',
        state: 'detected',
      },
    ]);
    fake.replaceRows('renewal_events', []);
    fake.replaceRows('chat_threads', [
      { id: 'thread-b', user_id: TECH_B, status: 'active' },
      { id: 'thread-null', user_id: '', status: 'active' },
    ]);
    fake.replaceRows('chat_messages', []);
  });

  it('scopes policies and renewals for ally_technical to assigned/shared clients only', async () => {
    const app = buildApiApp();
    const techAToken = tokenFor(TECH_A, 'ally_technical', ORG_1);
    const adminToken = tokenFor(ADMIN_1, 'ally_admin', ORG_1);

    const listPol = await request(app).get('/api/policies').set('Authorization', techAToken);
    expect(listPol.status).toBe(200);
    expect(listPol.body.map((p: { id: string }) => p.id)).toEqual(['pol-a']);

    expect((await request(app).get('/api/policies/pol-b').set('Authorization', techAToken)).status).toBe(404);
    expect((await request(app).delete('/api/policies/pol-b').set('Authorization', techAToken)).status).toBe(404);

    const listRen = await request(app).get('/api/renewals').set('Authorization', techAToken);
    expect(listRen.status).toBe(200);
    expect(listRen.body.map((r: { id: string }) => r.id)).toEqual(['ren-a']);

    const transForeign = await request(app)
      .post('/api/renewals/ren-b/transition')
      .set('Authorization', techAToken)
      .send({ to: 'notified' });
    expect(transForeign.status).toBe(404);

    // ally_admin still sees and transitions all org renewals
    const adminList = await request(app).get('/api/renewals').set('Authorization', adminToken);
    expect(adminList.status).toBe(200);
    expect(adminList.body).toHaveLength(2);

    const adminTrans = await request(app)
      .post('/api/renewals/ren-b/transition')
      .set('Authorization', adminToken)
      .send({ to: 'notified' });
    expect(adminTrans.status).toBe(200);
  });

  it('blocks ally_technical from deleting, sharing, or changing lead_status of unassigned org clients', async () => {
    const app = buildApiApp();
    const techAToken = tokenFor(TECH_A, 'ally_technical', ORG_1);

    expect((await request(app).delete('/api/clients/client-b').set('Authorization', techAToken)).status).toBe(404);
    expect(
      (
        await request(app)
          .post('/api/clients/client-b/share')
          .set('Authorization', techAToken)
          .send({ sharedWithUserId: TECH_A })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/api/clients/client-b/lead-status')
          .set('Authorization', techAToken)
          .send({ leadStatus: 'en_gestion' })
      ).status
    ).toBe(404);
  });

  it('blocks sharing or delegating clients to users outside the organization', async () => {
    await expect(
      shareClientWithUser({
        clientId: 'client-a',
        orgId: ORG_1,
        sharedWithUserId: OUTSIDER,
        sharedByUserId: TECH_A,
      })
    ).rejects.toThrow(/organización|organization/i);

    await expect(
      delegateClientToAdvisors({
        clientId: 'client-a',
        orgId: ORG_1,
        actorUserId: ADMIN_1,
        primaryAdvisorId: OUTSIDER,
      })
    ).rejects.toThrow(/organización|organization/i);
  });

  it('sanitizes PostgREST filter delimiters in searchOrgClientDirectory', async () => {
    const orSpy = vi.fn(async () => ({ data: [], error: null }));
    const { supabase } = await import('../../server/src/config/database');
    const origFrom = supabase.from;
    (supabase as unknown as { from: unknown }).from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              or: orSpy,
            }),
          }),
        }),
      }),
    }));

    try {
      await searchOrgClientDirectory(ORG_1, 'test),id.neq.0,(');
      const passedFilter = (orSpy.mock.calls[0] as unknown[] | undefined)?.[0] as string;
      expect(passedFilter).toBeDefined();
      expect(passedFilter).not.toContain('),');
      expect(passedFilter).not.toContain('(');
    } finally {
      (supabase as unknown as { from: unknown }).from = origFrom;
    }
  });

  it('prevents chat thread IDOR, rejects oversized messages, and separates systemInstruction', async () => {
    const app = buildApiApp();
    const techAToken = tokenFor(TECH_A, 'ally_technical', ORG_1);

    await expect(
      processChatMessage('Dame info', { id: 'rep-1' }, TECH_A, 'thread-b')
    ).rejects.toThrow(/autorizado|forbidden|belong/i);

    // Null/empty user_id thread must not be readable or deletable by another user
    const msgRes = await request(app)
      .get('/api/chat/threads/thread-null/messages')
      .set('Authorization', techAToken);
    expect(msgRes.status).toBe(403);

    const delRes = await request(app)
      .delete('/api/chat/threads/thread-null')
      .set('Authorization', techAToken);
    expect(delRes.status).toBe(403);

    const hugeRes = await request(app)
      .post('/api/chat')
      .set('Authorization', techAToken)
      .send({ message: 'x'.repeat(10001) });
    expect(hugeRes.status).toBe(400);

    // System prompt must be sent in config.systemInstruction, not concatenated in user prompt
    vi.spyOn(chatRepository, 'getThread').mockResolvedValueOnce({
      id: 'thread-a',
      user_id: TECH_A,
      status: 'active',
      created_at: '',
      updated_at: '',
    });
    vi.spyOn(chatRepository, 'saveMessage').mockResolvedValue(undefined);
    vi.spyOn(chatRepository, 'getHistory').mockResolvedValue([]);

    await processChatMessage('Hola', { id: 'rep-1', quotes: [] }, TECH_A, 'thread-a');
    expect(holder.generateContentMock).toHaveBeenCalledTimes(1);
    const callArg = (holder.generateContentMock.mock.calls[0] as unknown[])[0] as {
      contents: Array<{ parts: Array<{ text: string }> }>;
      config: { systemInstruction?: string };
    };
    expect(callArg.config.systemInstruction).toContain('SeguroBot AI');
    expect(callArg.contents[0].parts[0].text).not.toContain('SeguroBot AI');
    expect(callArg.contents[0].parts[0].text).not.toContain('REGLAS ESTRICTAS');
  });

  it('validates PDF magic bytes and sanitizes upload fieldname', () => {
    expect(sanitizeUploadFieldname('../../etc/passwd')).toBe('etcpasswd');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-magic-'));
    try {
      const fakePdf = path.join(tmpDir, 'fake.pdf');
      const realPdf = path.join(tmpDir, 'real.pdf');
      fs.writeFileSync(fakePdf, '<html><script>alert(1)</script></html>');
      fs.writeFileSync(realPdf, '%PDF-1.4\n1 0 obj\n<<>>\nendobj');

      expect(validatePdfMagicBytes(fakePdf)).toBe(false);
      expect(validatePdfMagicBytes(realPdf)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
