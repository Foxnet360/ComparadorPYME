import { describe, it, expect } from 'vitest';
import { quoteScorer } from '../quoteScorer';
import { ParsedQuote } from '../quoteParser';

function makeAutosQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'Autos Insurer',
    policyName: 'Autos Policy',
    priceAnnual: 2_500_000,
    currency: 'COP',
    coverages: [
      {
        name: 'RCE vehicular',
        canonicalName: 'Responsabilidad Civil Extracontractual Vehicular',
        value: '1.000M',
        deductible: 'No aplica',
        confidence: 95,
      },
      {
        name: 'PT',
        canonicalName: 'Pérdida Total (hurto, daños, PT)',
        value: 'Incluido',
        deductible: 'No aplica',
        confidence: 95,
      },
      {
        name: 'PP',
        canonicalName: 'Pérdida Parcial (colisión, PP)',
        value: 'Incluido',
        deductible: '10%',
        confidence: 95,
      },
      {
        name: 'Deducibles',
        canonicalName: 'Deducibles (SMMLV / días de inmovilización / %)',
        value: 'Ver condiciones',
        deductible: 'Ver condiciones',
        confidence: 90,
      },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 95,
    ...overrides,
  };
}

describe('quoteScorer - autos domain', () => {
  it('scores an autos quote with low RCE and no carro taller lower than one with adequate RCE and carro taller', () => {
    const lowRceQuote = makeAutosQuote({
      insurerName: 'Low RCE Insurer',
      coverages: [
        {
          name: 'RCE vehicular',
          canonicalName: 'Responsabilidad Civil Extracontractual Vehicular',
          value: '500M',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'PT',
          canonicalName: 'Pérdida Total (hurto, daños, PT)',
          value: 'Incluido',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'PP',
          canonicalName: 'Pérdida Parcial (colisión, PP)',
          value: 'Incluido',
          deductible: '10%',
          confidence: 95,
        },
        {
          name: 'Deducibles',
          canonicalName: 'Deducibles (SMMLV / días de inmovilización / %)',
          value: 'Ver condiciones',
          deductible: 'Ver condiciones',
          confidence: 90,
        },
      ],
    });

    const goodQuote = makeAutosQuote({
      insurerName: 'Good Insurer',
      coverages: [
        {
          name: 'RCE vehicular',
          canonicalName: 'Responsabilidad Civil Extracontractual Vehicular',
          value: '2.000M',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'PT',
          canonicalName: 'Pérdida Total (hurto, daños, PT)',
          value: 'Incluido',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'PP',
          canonicalName: 'Pérdida Parcial (colisión, PP)',
          value: 'Incluido',
          deductible: '10%',
          confidence: 95,
        },
        {
          name: 'Carro Taller',
          canonicalName: 'Carro Taller / Vehículo de Reemplazo',
          value: 'Incluido',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'Asistencia',
          canonicalName: 'Asistencia en Viaje / Carretera',
          value: 'Incluido',
          deductible: 'No aplica',
          confidence: 95,
        },
        {
          name: 'Deducibles',
          canonicalName: 'Deducibles (SMMLV / días de inmovilización / %)',
          value: 'Ver condiciones',
          deductible: 'Ver condiciones',
          confidence: 90,
        },
      ],
    });

    const lowResult = quoteScorer.calculateScore(
      lowRceQuote,
      [],
      [],
      undefined,
      undefined,
      'autos'
    );
    const goodResult = quoteScorer.calculateScore(goodQuote, [], [], undefined, undefined, 'autos');

    expect(goodResult.totalScore).toBeGreaterThan(lowResult.totalScore);
    expect(goodResult.breakdown.coverage).toBeGreaterThan(lowResult.breakdown.coverage);
  });

  it('keeps pyme scoring byte-identical when domain is omitted', () => {
    const pymeQuote: ParsedQuote = {
      insurerName: 'PYME Insurer',
      policyName: 'PYME Policy',
      priceAnnual: 8_500_000,
      currency: 'COP',
      coverages: [
        {
          name: 'Responsabilidad Civil (RCE)',
          canonicalName: 'Responsabilidad Civil (RCE)',
          value: '100M',
          deductible: '5 SMMLV',
          confidence: 90,
        },
        {
          name: 'Incendio',
          canonicalName: 'Incendio',
          value: '500M',
          deductible: '10%',
          confidence: 95,
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    };

    const resultDefault = quoteScorer.calculateScore(pymeQuote, [], []);
    const resultExplicit = quoteScorer.calculateScore(
      pymeQuote,
      [],
      [],
      undefined,
      undefined,
      'pyme'
    );

    expect(resultExplicit.totalScore).toBe(resultDefault.totalScore);
    expect(resultExplicit.breakdown).toEqual(resultDefault.breakdown);
    expect(resultExplicit.expectedCoverageCount).toBe(resultDefault.expectedCoverageCount);
  });

  it('uses autos taxonomy expected coverage count for autos domain', () => {
    const autosQuote = makeAutosQuote();
    const result = quoteScorer.calculateScore(autosQuote, [], [], undefined, undefined, 'autos');

    expect(result.expectedCoverageCount).toBe(17);
  });

  it('applies collective underwriting bonuses for autos (Amparo Patrimonial), salud (Continuidad), and vida_grupo (Free Cover & Profit Sharing)', () => {
    const baseAutos = makeAutosQuote();
    const fleetAutos = makeAutosQuote({
      coverages: [
        ...baseAutos.coverages,
        {
          name: 'Amparo Patrimonial',
          canonicalName: 'Amparo Patrimonial (Culpa Grave / Infracción de Tránsito)',
          value: 'Incluido 100%',
          deductible: 'No aplica',
          confidence: 0.95,
        },
      ],
    });
    const baseAutosScore = quoteScorer.calculateScore(
      baseAutos,
      [],
      [],
      undefined,
      undefined,
      'autos'
    );
    const fleetAutosScore = quoteScorer.calculateScore(
      fleetAutos,
      [],
      [],
      undefined,
      undefined,
      'autos'
    );
    expect(fleetAutosScore.breakdown.coverage).toBeGreaterThan(baseAutosScore.breakdown.coverage);

    const baseVida = makeAutosQuote({
      insurerName: 'Vida Base',
      priceAnnual: 450_000,
      coverages: [
        {
          name: 'Amparo Básico por Muerte',
          canonicalName: 'Amparo Básico por Muerte (Cualquier Causa)',
          value: '100000000',
          deductible: 'No aplica',
          confidence: 0.95,
        },
      ],
    });
    const collectiveVida = {
      ...baseVida,
      collectiveDetails: {
        isCollective: true,
        freeCoverLimit: 200_000_000,
        profitSharing: '20% sobre utilidad técnica',
      },
    };
    const baseVidaScore = quoteScorer.calculateScore(
      baseVida,
      [],
      [],
      undefined,
      undefined,
      'vida_grupo'
    );
    const collectiveVidaScore = quoteScorer.calculateScore(
      collectiveVida,
      [],
      [],
      undefined,
      undefined,
      'vida_grupo'
    );
    expect(collectiveVidaScore.breakdown.coverage).toBeGreaterThan(
      baseVidaScore.breakdown.coverage
    );

    const baseSalud = makeAutosQuote({
      insurerName: 'Salud Base',
      priceAnnual: 350_000,
      coverages: [
        {
          name: 'Hospitalización y Cirugía',
          canonicalName: 'Hospitalización y Cirugía',
          value: 'Ilimitado',
          deductible: 'Sin copago',
          confidence: 0.95,
        },
      ],
    });
    const collectiveSalud = {
      ...baseSalud,
      collectiveDetails: {
        isCollective: true,
        continuityAndPreexisting: 'Continuidad de antigüedad y exoneración de carencias',
      },
    };
    const baseSaludScore = quoteScorer.calculateScore(
      baseSalud,
      [],
      [],
      undefined,
      undefined,
      'salud'
    );
    const collectiveSaludScore = quoteScorer.calculateScore(
      collectiveSalud,
      [],
      [],
      undefined,
      undefined,
      'salud'
    );
    expect(collectiveSaludScore.breakdown.coverage).toBeGreaterThan(
      baseSaludScore.breakdown.coverage
    );
  });
});
