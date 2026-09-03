import { readFileSync } from 'fs';
import { join } from 'path';

// OBS-4 / DEV-2: coverage thresholds must be enabled and set to meaningful
// floors (current branch coverage minus ~2pp), not left at zero or commented
// out. See Informe_deuda.md: "Umbrales de cobertura en 20%/15% -> confianza falsa".
const configSource = readFileSync(join(__dirname, '../../vitest.config.ts'), 'utf8');

const readThreshold = (metric: string): number => {
  const match = configSource.match(new RegExp(`^\\s*${metric}:\\s*(\\d+)`, 'm'));
  if (!match) {
    throw new Error(`coverage threshold "${metric}" is not enabled in vitest.config.ts`);
  }
  return Number(match[1]);
};

describe('vitest coverage thresholds (OBS-4)', () => {
  it.each([
    ['lines', 42],
    ['statements', 41],
    ['functions', 43],
    ['branches', 34],
  ])('enforces a non-trivial %s floor', (metric, floor) => {
    const value = readThreshold(metric);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeGreaterThanOrEqual(floor);
  });

  it('keeps the thresholds block active (not commented out)', () => {
    const activeThresholds = configSource
      .split('\n')
      .filter((line) => /^\s*(lines|statements|functions|branches):\s*\d+/.test(line));
    expect(activeThresholds).toHaveLength(4);
  });
});
