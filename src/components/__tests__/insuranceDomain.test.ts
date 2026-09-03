import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { InsuranceDomain, type InsuranceDomainType } from '../../../shared/insuranceDomain';

const EXPECTED_DOMAINS: Record<string, string> = {
  PYME: 'pyme',
  AUTOS: 'autos',
  COPROPIEDADES: 'copropiedades',
  VIDA_GRUPO: 'vida_grupo',
  SALUD: 'salud',
  CUMPLIMIENTO: 'cumplimiento',
  TRANSPORTE: 'transporte',
  HOGAR: 'hogar',
  EQUIPO_MAQUINARIA: 'equipo_maquinaria',
  CASCO_EMBARCACION: 'casco_embarcacion',
};

const DOMAIN_LITERAL_PATTERN =
  /'(pyme|autos|copropiedades|vida_grupo|salud|cumplimiento|transporte|hogar|equipo_maquinaria|casco_embarcacion)'/g;

// Files refactored in slice 4 must reference domains through the shared enum
// instead of raw string literals.
const SCANNED_FILES = [
  'App.tsx',
  'hooks/useAnalysisFlow.ts',
  'hooks/useAuthSession.ts',
  'components/layout/AppHeader.tsx',
  'pages/AnalyzerPage.tsx',
  'pages/DashboardPage.tsx',
  'pages/ReportPage.tsx',
  'pages/ClientsPage.tsx',
  'pages/AnalyticsPage.tsx',
  'pages/UsersPage.tsx',
];

describe('shared/insuranceDomain (ARCH-4)', () => {
  it('exports an enum with all ten canonical domain values', () => {
    expect(Object.keys(EXPECTED_DOMAINS)).toHaveLength(10);
    for (const [member, value] of Object.entries(EXPECTED_DOMAINS)) {
      expect(InsuranceDomain[member as keyof typeof InsuranceDomain]).toBe(value);
    }
  });

  it('produces a literal-union type assignable both ways', () => {
    const fromEnum: InsuranceDomainType = InsuranceDomain.PYME;
    const fromLiteral: InsuranceDomainType = 'autos';
    expect(fromEnum).toBe('pyme');
    expect(fromLiteral).toBe('autos');
  });

  it('is re-exported from types.ts so existing imports keep working', async () => {
    const typesModule = await import('../../../types');
    expect(typesModule.InsuranceDomain.PYME).toBe('pyme');
    expect(typesModule.InsuranceDomain.CASCO_EMBARCACION).toBe('casco_embarcacion');
  });

  it.each(SCANNED_FILES)('changed file %s contains no domain string literals', (file) => {
    const source = readFileSync(join(__dirname, '../../..', file), 'utf8');
    const matches = source.match(DOMAIN_LITERAL_PATTERN) ?? [];
    expect(matches).toEqual([]);
  });
});
