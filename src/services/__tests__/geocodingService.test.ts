import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  geocodeClientAddress,
  normalizeColombianAddress,
} from '../geocodingService';

describe('geocodingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeColombianAddress', () => {
    it('normalizes common Colombian road abbreviations', () => {
      const input = 'cra 15 # 85-30 piso 4';
      const normalized = normalizeColombianAddress(input);
      expect(normalized).toContain('Carrera 15');
      expect(normalized).not.toContain('#');
    });

    it('expands cll to Calle and av to Avenida', () => {
      const input = 'cll 72 con av chile';
      const normalized = normalizeColombianAddress(input);
      expect(normalized).toContain('Calle 72');
      expect(normalized).toContain('Avenida chile');
    });

    it('handles empty input gracefully', () => {
      expect(normalizeColombianAddress('')).toBe('');
    });
  });

  describe('geocodeClientAddress', () => {
    it('returns municipality centroid when address is empty', async () => {
      const result = await geocodeClientAddress({
        address: '',
        city: 'Medellín',
        department: 'Antioquia',
      });

      expect(result.source).toBe('municipality_fallback');
      expect(result.latitude).toBeCloseTo(6.2466, 2);
      expect(result.longitude).toBeCloseTo(-75.5818, 2);
      expect(result.message).toContain('Medellín');
    });

    it('returns address_precise when Nominatim returns coordinate matches', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: '4.6513',
            lon: '-74.0499',
            display_name: 'Calle 72, Chapinero, Bogotá, Colombia',
            importance: 0.85,
          },
        ],
      });
      globalThis.fetch = mockFetch;

      const result = await geocodeClientAddress({
        address: 'Calle 72 # 10-07',
        city: 'Bogotá D.C.',
        department: 'Bogotá D.C.',
      });

      expect(result.source).toBe('address_precise');
      expect(result.latitude).toBe(4.6513);
      expect(result.longitude).toBe(-74.0499);
      expect(result.displayName).toContain('Chapinero');
    });

    it('gracefully falls back to municipality when network fails', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      globalThis.fetch = mockFetch;

      const result = await geocodeClientAddress({
        address: 'Carrera 7 # 123-45',
        city: 'Cali',
        department: 'Valle del Cauca',
      });

      expect(result.source).toBe('municipality_fallback');
      expect(result.latitude).toBeCloseTo(3.4137, 1);
      expect(result.longitude).toBeCloseTo(-76.5411, 1);
      expect(result.message).toContain('Cali');
    });
  });
});
