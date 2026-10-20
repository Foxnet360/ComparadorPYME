import { describe, it, expect, beforeEach } from 'vitest';
import { insurerNameNormalizer } from '../insurerNameNormalizer';

describe('insurerNameNormalizer', () => {
  beforeEach(() => {
    insurerNameNormalizer.clearTelemetry();
  });

  describe('normalize', () => {
    it('returns "SBS" for direct mapping "SBS SEGUROS COLOMBIA S.A."', () => {
      expect(insurerNameNormalizer.normalize('SBS SEGUROS COLOMBIA S.A.')).toBe('SBS');
    });

    it('returns "SBS" for case-insensitive input "sbs seguros"', () => {
      expect(insurerNameNormalizer.normalize('sbs seguros')).toBe('SBS');
    });

    it('returns "BOLÍVAR" for alias inclusion "Seguros Bolivar"', () => {
      expect(insurerNameNormalizer.normalize('Seguros Bolivar')).toBe('BOLÍVAR');
    });

    it('normalizes ZURICH, HDI, LIBERTY, SOLIDARIA, LA PREVISORA, and SEGUROS DEL ESTADO without unmapped warnings', () => {
      insurerNameNormalizer.clearTelemetry();
      expect(insurerNameNormalizer.normalize('ZURICH')).toBe('ZURICH');
      expect(insurerNameNormalizer.normalize('Zurich Colombia Seguros S.A.')).toBe('ZURICH');
      expect(insurerNameNormalizer.normalize('HDI (ANTES LIBERTY)')).toBe('HDI');
      expect(insurerNameNormalizer.normalize('HDI Seguros (antes Liberty Seguros)')).toBe('HDI');
      expect(insurerNameNormalizer.normalize('Liberty Seguros S.A.')).toBe('LIBERTY');
      expect(insurerNameNormalizer.normalize('Aseguradora Solidaria de Colombia')).toBe(
        'SOLIDARIA'
      );
      expect(insurerNameNormalizer.normalize('La Previsora S.A.')).toBe('LA PREVISORA');
      expect(insurerNameNormalizer.normalize('Seguros del Estado S.A.')).toBe('SEGUROS DEL ESTADO');
      expect(insurerNameNormalizer.getUnmappedTelemetry()).toEqual([]);
    });

    it('returns original name for unknown insurer', () => {
      expect(insurerNameNormalizer.normalize('UNKNOWN INSURER XYZ')).toBe('UNKNOWN INSURER XYZ');
    });
  });

  describe('getUnmappedTelemetry', () => {
    it('accumulates frequency for repeated unmapped names', () => {
      insurerNameNormalizer.normalize('UNKNOWN INSURER XYZ');
      insurerNameNormalizer.normalize('UNKNOWN INSURER XYZ');
      insurerNameNormalizer.normalize('UNKNOWN INSURER XYZ');

      const telemetry = insurerNameNormalizer.getUnmappedTelemetry();
      expect(telemetry).toHaveLength(1);
      expect(telemetry[0]).toEqual({ name: 'UNKNOWN INSURER XYZ', frequency: 3 });
    });
  });

  describe('clearTelemetry', () => {
    it('resets telemetry to empty array', () => {
      insurerNameNormalizer.normalize('UNKNOWN INSURER XYZ');
      insurerNameNormalizer.clearTelemetry();
      expect(insurerNameNormalizer.getUnmappedTelemetry()).toEqual([]);
    });
  });
});
