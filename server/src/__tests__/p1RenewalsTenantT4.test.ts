import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { runRenewalDetection } from '../services/renewalDetection';
import { runCampaignTick, sendManualDelivery } from '../services/campaignService';
import * as renewalRepo from '../repositories/renewalRepository';
import * as policyRepo from '../repositories/policyRepository';
import * as campaignRepo from '../repositories/campaignRepository';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { unifiedComparisonEngine } from '../services/unifiedComparison/unifiedComparisonEngine';
import * as quoteProcessingService from '../services/quoteProcessingService';

vi.mock('../repositories/renewalRepository', () => ({
  listPoliciesWithEndDate: vi.fn(),
  listOpenRenewalsForPolicies: vi.fn(),
  createRenewal: vi.fn(),
  listOpenRenewals: vi.fn(),
  applyTransition: vi.fn(),
}));

vi.mock('../repositories/policyRepository', () => ({
  listPoliciesByIds: vi.fn(),
}));

vi.mock('../repositories/campaignRepository', () => ({
  listEnabledCampaignConfigs: vi.fn(),
  listDeliveriesForRenewals: vi.fn(),
  insertDelivery: vi.fn(),
  markDeliverySent: vi.fn(),
  deleteDelivery: vi.fn(),
  getDelivery: vi.fn(),
}));

vi.mock('../services/unifiedComparison/unifiedComparisonEngine', () => ({
  unifiedComparisonEngine: { compare: vi.fn() },
  UnifiedComparisonError: class UnifiedComparisonError extends Error {
    constructor(
      public readonly reason: string,
      public readonly correlationId: string,
      public readonly attempts: number
    ) {
      super(reason);
    }
  },
}));

vi.mock('../services/quoteProcessingService', () => ({
  processQuotesBatch: vi.fn(async () => [
    {
      insurerName: 'SURA',
      policyName: 'PYME Gold',
      priceAnnual: 1200000,
      currency: 'COP',
      coverages: [
        { name: 'Incendio', canonicalName: 'Incendio', value: '500M', deductible: '10%' },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    },
  ]),
}));

describe('P1 Renewals Multi-Tenant, ReferenceQuote & Campaign Resilience (T4 / S3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runRenewalDetection propagates policy org_id to createRenewal', async () => {
    vi.mocked(renewalRepo.listPoliciesWithEndDate).mockResolvedValue([
      { id: 'pol-1', user_id: 'u-1', org_id: 'org-99', end_date: '2026-12-10' } as never,
    ]);
    vi.mocked(renewalRepo.listOpenRenewalsForPolicies).mockResolvedValue([]);
    vi.mocked(renewalRepo.createRenewal).mockResolvedValue({
      kind: 'created',
      renewal: {} as never,
    });

    const res = await runRenewalDetection({ horizonDays: 60, today: '2026-11-22' });

    expect(res.created).toBe(1);
    expect(renewalRepo.createRenewal).toHaveBeenCalledWith(
      'u-1',
      { policy_id: 'pol-1', cycle_start: '2026-12-10' },
      'org-99'
    );
  });

  it('runCampaignTick releases pending delivery when notifier.send fails and forwards org_id on transition', async () => {
    vi.mocked(campaignRepo.listEnabledCampaignConfigs).mockResolvedValue([
      { id: 'cfg-1', user_id: 'u-1', windows: [30], enabled: true, created_at: '', updated_at: '' },
    ]);
    vi.mocked(renewalRepo.listOpenRenewals).mockResolvedValue([
      {
        id: 'ren-1',
        user_id: 'u-1',
        org_id: 'org-42',
        policy_id: 'pol-1',
        cycle_start: '2026-12-10',
        state: 'detected',
        outcome: null,
        final_premium: null,
        loss_reason: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    vi.mocked(policyRepo.listPoliciesByIds).mockResolvedValue([
      { id: 'pol-1', end_date: '2026-12-10' } as never,
    ]);
    vi.mocked(campaignRepo.listDeliveriesForRenewals).mockResolvedValue([]);
    vi.mocked(campaignRepo.insertDelivery).mockResolvedValue({
      kind: 'created',
      delivery: {
        id: 'del-1',
        renewal_id: 'ren-1',
        window_key: '30',
        channel: 'email',
        status: 'pending',
        sent_at: null,
        created_at: '',
      },
    });
    vi.mocked(campaignRepo.deleteDelivery).mockResolvedValue(undefined);

    await expect(
      runCampaignTick({
        today: '2026-11-22',
        notifier: {
          send: vi.fn().mockRejectedValue(new Error('SMTP timeout')),
        },
      })
    ).rejects.toThrow('SMTP timeout');

    expect(campaignRepo.deleteDelivery).toHaveBeenCalledWith('ren-1', '30');
    expect(campaignRepo.markDeliverySent).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(campaignRepo.listEnabledCampaignConfigs).mockResolvedValue([
      { id: 'cfg-1', user_id: 'u-1', windows: [30], enabled: true, created_at: '', updated_at: '' },
    ]);
    vi.mocked(renewalRepo.listOpenRenewals).mockResolvedValue([
      {
        id: 'ren-1',
        user_id: 'u-1',
        org_id: 'org-42',
        policy_id: 'pol-1',
        cycle_start: '2026-12-10',
        state: 'detected',
        outcome: null,
        final_premium: null,
        loss_reason: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    vi.mocked(policyRepo.listPoliciesByIds).mockResolvedValue([
      { id: 'pol-1', end_date: '2026-12-10' } as never,
    ]);
    vi.mocked(campaignRepo.listDeliveriesForRenewals).mockResolvedValue([]);
    vi.mocked(campaignRepo.insertDelivery).mockResolvedValue({
      kind: 'created',
      delivery: {
        id: 'del-2',
        renewal_id: 'ren-1',
        window_key: '30',
        channel: 'email',
        status: 'pending',
        sent_at: null,
        created_at: '',
      },
    });
    vi.mocked(campaignRepo.markDeliverySent).mockResolvedValue(undefined);
    vi.mocked(renewalRepo.applyTransition).mockResolvedValue({} as never);

    await runCampaignTick({
      today: '2026-11-22',
      notifier: { send: vi.fn().mockResolvedValue(undefined) },
    });

    expect(renewalRepo.applyTransition).toHaveBeenCalledWith(
      'u-1',
      'ren-1',
      expect.objectContaining({ from: 'detected', to: 'notified' }),
      'system',
      'org-42'
    );
  });

  it('sendManualDelivery releases pending delivery on send failure and forwards orgId/role on success', async () => {
    vi.mocked(campaignRepo.insertDelivery).mockResolvedValue({
      kind: 'created',
      delivery: {
        id: 'del-3',
        renewal_id: 'ren-2',
        window_key: '7',
        channel: 'email',
        status: 'pending',
        sent_at: null,
        created_at: '',
      },
    });
    vi.mocked(campaignRepo.deleteDelivery).mockResolvedValue(undefined);

    await expect(
      sendManualDelivery({
        userId: 'u-1',
        orgId: 'org-42',
        role: 'ally_admin',
        renewalId: 'ren-2',
        renewalState: 'detected',
        windowKey: '7',
        actorId: 'u-1',
        notifier: { send: vi.fn().mockRejectedValue(new Error('Gateway 503')) },
      })
    ).rejects.toThrow('Gateway 503');

    expect(campaignRepo.deleteDelivery).toHaveBeenCalledWith('ren-2', '7');

    vi.clearAllMocks();
    vi.mocked(campaignRepo.insertDelivery).mockResolvedValue({
      kind: 'created',
      delivery: {
        id: 'del-4',
        renewal_id: 'ren-2',
        window_key: '7',
        channel: 'email',
        status: 'pending',
        sent_at: null,
        created_at: '',
      },
    });
    vi.mocked(campaignRepo.markDeliverySent).mockResolvedValue(undefined);
    vi.mocked(renewalRepo.applyTransition).mockResolvedValue({} as never);
    vi.mocked(campaignRepo.getDelivery).mockResolvedValue(null);

    await sendManualDelivery({
      userId: 'u-1',
      orgId: 'org-42',
      role: 'ally_admin',
      renewalId: 'ren-2',
      renewalState: 'detected',
      windowKey: '7',
      actorId: 'u-1',
      notifier: { send: vi.fn().mockResolvedValue(undefined) },
    });

    expect(renewalRepo.applyTransition).toHaveBeenCalledWith(
      'u-1',
      'ren-2',
      expect.objectContaining({ from: 'detected', to: 'notified' }),
      'u-1',
      'org-42',
      'ally_admin'
    );
  });

  it('comparisonEngineAdapter preserves referenceQuote baseline in large batches (>3 files) and fallback paths', async () => {
    const refQuote = {
      insurerName: 'Seguros Bolívar',
      policyName: 'Póliza 123',
      priceAnnual: 1000000,
      currency: 'COP',
      coverages: [
        { name: 'Incendio', canonicalName: 'Incendio', value: '450M', deductible: '10%' },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 90,
    } as never;

    const batchRes = await comparisonEngineAdapter.generateComparison(
      ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'],
      {
        userId: 'u1',
        analysisType: 'renewal',
        referenceQuote: refQuote,
      }
    );
    expect(batchRes.matrix.find((r) => r.id === 'baseline_column')).toBeDefined();
    expect(quoteProcessingService.processQuotesBatch).toHaveBeenCalledTimes(1);

    vi.mocked(unifiedComparisonEngine.compare).mockRejectedValueOnce(new Error('LLM overloaded'));
    const fallbackRes = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
      referenceQuote: refQuote,
    });
    expect(fallbackRes.matrix.find((r) => r.id === 'baseline_column')).toBeDefined();
    expect(fallbackRes.engine).toBe('fallback');
    expect(fallbackRes.schemaVersion).toBe(3);

    // V1 invariant: granularComparisonSchema: false never injects baseline_column or emits v3
    const v1BatchRes = await comparisonEngineAdapter.generateComparison(
      ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'],
      {
        userId: 'u1',
        analysisType: 'renewal',
        granularComparisonSchema: false,
        referenceQuote: refQuote,
      }
    );
    expect(v1BatchRes.schemaVersion).toBe(1);
    expect(v1BatchRes.matrix.find((r) => r.id === 'baseline_column')).toBeUndefined();
    expect(v1BatchRes.matrix.every((r) => r.isBaseline !== true)).toBe(true);

    vi.mocked(unifiedComparisonEngine.compare).mockRejectedValueOnce(new Error('LLM overloaded'));
    const v1FallbackRes = await comparisonEngineAdapter.generateComparison(['a.pdf', 'b.pdf'], {
      userId: 'u1',
      analysisType: 'renewal',
      granularComparisonSchema: false,
      referenceQuote: refQuote,
    });
    expect(v1FallbackRes.schemaVersion).toBe(1);
    expect(v1FallbackRes.engine).toBe('fallback');
    expect(v1FallbackRes.matrix.find((r) => r.id === 'baseline_column')).toBeUndefined();
    expect(v1FallbackRes.matrix.every((r) => r.isBaseline !== true)).toBe(true);
  });

  it('analysisController passes orgId and role to getPolicyById for renewal referenceQuote', () => {
    const controllerText = readFileSync(
      join(__dirname, '../controllers/analysisController.ts'),
      'utf8'
    );
    expect(controllerText).toMatch(
      /getPolicyById\(\s*userId,\s*policyId,\s*authUser\?\.orgId,\s*authUser\?\.role/
    );
  });
});
