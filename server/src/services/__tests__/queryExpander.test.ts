import { queryExpander } from '../queryExpander';

describe('queryExpander', () => {
  it('should expand deductible query with synonyms', () => {
    const expansions = queryExpander.expand('deducible incendio');

    expect(expansions.length).toBeGreaterThan(1);
    expect(expansions[0].type).toBe('original');
    expect(expansions[0].query).toBe('deducible incendio');

    // Should include synonym
    const hasSynonym = expansions.some(
      (e) => e.type === 'synonym' && e.query.includes('franquicia')
    );
    expect(hasSynonym).toBe(true);
  });

  it('should expand with insurer-specific variants', () => {
    const expansions = queryExpander.expand('deducible incendio', {
      insurerName: 'AXA',
    });

    const hasInsurerVariant = expansions.some((e) => e.type === 'insurer_variant');
    expect(hasInsurerVariant).toBe(true);
  });

  it('should limit expansions to max', () => {
    const expansions = queryExpander.expand('deducible incendio', {
      maxExpansions: 3,
    });

    expect(expansions.length).toBeLessThanOrEqual(4); // original + 3
  });

  it('should return original query only when no synonyms found', () => {
    const expansions = queryExpander.expand('xyz unknown term');

    expect(expansions.length).toBe(1);
    expect(expansions[0].type).toBe('original');
  });

  it('should batch expand multiple queries', () => {
    const results = queryExpander.expandBatch(['deducible incendio', 'cobertura hurto']);

    expect(results.size).toBe(2);
    expect(results.has('deducible incendio')).toBe(true);
    expect(results.has('cobertura hurto')).toBe(true);
  });
});
