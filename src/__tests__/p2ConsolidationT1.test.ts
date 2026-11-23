import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { buildBrokerInfo } from '../../utils/brokerInfo';
import { rejectSpoofedUserId } from '../../server/src/middleware/validateRequest';

describe('P2 Dependency Pruning, Consolidation & Format Integrity (T1 / S1)', () => {
  it('package.json excludes unused dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const unused of [
      'redis',
      'dompurify',
      '@types/dompurify',
      'pdf-parse',
      'esbuild',
      '@tanstack/react-virtual',
    ]) {
      expect(allDeps[unused]).toBeUndefined();
    }
  });

  it('removes confirmed orphan root files', () => {
    for (const rel of ['utils/stringUtils.ts', 'types/analysis.ts', 'utils/logger.ts']) {
      expect(existsSync(join(__dirname, '../../', rel))).toBe(false);
    }
  });

  it('buildBrokerInfo builds consistent broker metadata with fallback defaults', () => {
    const fallback = buildBrokerInfo(null);
    expect(fallback.name).toBe('Técnico Analista de Seguros');
    expect(fallback.email).toBe('soporte@comparadorcsa.com');
    expect(fallback.logoUrl).toBeUndefined();

    const custom = buildBrokerInfo({
      id: 'u1',
      name: 'Ana Gómez',
      email: 'ana@csa.co',
      role: 'analyst',
      avatarUrl: '',
      agentDetails: { logoUrl: 'https://cdn.example/logo.png', phone: '3001112233' },
    });
    expect(custom.name).toBe('Ana Gómez');
    expect(custom.phone).toBe('3001112233');
    expect(custom.logoUrl).toBe('https://cdn.example/logo.png');
  });

  it('shared rejectSpoofedUserId rejects body/query userId and forwards clean requests', () => {
    const next = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    rejectSpoofedUserId(
      { query: { userId: 'evil' }, body: {} } as never,
      { status } as never,
      next
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();

    const nextClean = vi.fn();
    rejectSpoofedUserId(
      { query: {}, body: { name: 'Ok' } } as never,
      { status } as never,
      nextClean
    );
    expect(nextClean).toHaveBeenCalledTimes(1);
  });

  it('frontend callers do not keep unreachable if (!response.ok) blocks after apiClient.fetch', () => {
    for (const rel of [
      'hooks/useAuditEnrichment.ts',
      'services/geminiService.ts',
      'components/ChatBot.tsx',
    ]) {
      const text = readFileSync(join(__dirname, '../../', rel), 'utf8');
      expect(text).not.toMatch(/if\s*\(\s*!response\.ok\s*\)/);
    }
  });
});
