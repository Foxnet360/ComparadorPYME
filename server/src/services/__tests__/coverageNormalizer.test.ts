import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCanonicalCoverages } from '../coverageNormalizer';
import { featureFlags } from '../../config/featureFlags';
import { coverageOntology } from '../coverageOntology';

vi.mock('../semanticMatcher', () => ({
  semanticMatcher: {
    getAllCategories: vi.fn(() => [
      { id: 1, name: 'Incendio (Edificio y Contenidos)' },
      { id: 2, name: 'Terremoto y Eventos Catastróficos' },
    ]),
  },
}));

vi.mock('../coverageOntology', () => ({
  coverageOntology: {
    mapCoverage: vi.fn(),
    saveMapping: vi.fn(async () => {}),
    getNodeById: vi.fn(() => ({ id: '1', name: 'Incendio (Edificio y Contenidos)' })),
  },
  default: {
    mapCoverage: vi.fn(),
    saveMapping: vi.fn(async () => {}),
    getNodeById: vi.fn(() => ({ id: '1', name: 'Incendio (Edificio y Contenidos)' })),
  }
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
  },
}));

describe('coverageNormalizer Promise Pool Concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isEnabled).mockImplementation((flag: string) => {
      if (flag === 'semanticCoverageOntology') return true;
      if (flag === 'useLegacyCoverageMatcher') return false;
      return false;
    });
  });

  it('limits concurrency to 5 when resolving coverage mapping through ontology', async () => {
    let activeCalls = 0;
    let maxActiveCalls = 0;

    vi.mocked(coverageOntology.mapCoverage).mockImplementation(async (rawName) => {
      activeCalls++;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      // Wait for 20ms to allow concurrent execution
      await new Promise(resolve => setTimeout(resolve, 20));
      activeCalls--;
      return {
        rawName,
        groups: [{ groupId: '1', confidence: 0.9 }],
        isComposite: false,
        confidence: 0.9,
      };
    });

    const rawCoverages = Array.from({ length: 15 }, (_, i) => ({
      rawName: `Cobertura Raw ${i}`,
    }));

    await buildCanonicalCoverages(rawCoverages, [], [], {}, 'pyme');

    expect(maxActiveCalls).toBeLessThanOrEqual(5);
    expect(coverageOntology.mapCoverage).toHaveBeenCalledTimes(15);
  });
});
