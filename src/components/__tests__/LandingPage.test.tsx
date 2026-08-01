import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const LANDING_PAGE_PATH = path.join(__dirname, '../../../components/LandingPage.tsx');

describe('PR5 landing-cosmetics verification', () => {
  it('5.1 LandingPage.tsx includes updated trust bar insurers (SBS, BBVA, Seguros Bolívar)', () => {
    const code = fs.readFileSync(LANDING_PAGE_PATH, 'utf-8');

    expect(code).toContain('SBS');
    expect(code).toContain('BBVA');
    expect(code).toContain('Seguros Bolívar');
    expect(code).toContain('AXA COLPATRIA');
    expect(code).toContain('Allianz');
    expect(code).toContain('MAPFRE');
    expect(code).toContain('SURA');
  });

  it('5.2 LandingPage.tsx footer displays © 2026 copyright year', () => {
    const code = fs.readFileSync(LANDING_PAGE_PATH, 'utf-8');

    expect(code).toContain('© 2026 Comparador Seguros CSA');
    expect(code).not.toContain('© 2024 Comparador Seguros CSA');
  });
});
