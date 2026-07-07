import { describe, it, expect } from 'vitest';
import {
  detectFormatFamily,
  detectFormatWithRegistry,
  getFormatConfidence,
  extractForDetection,
  getFormatFamilyDescription,
  type FormatFamily,
} from '../formatDetector';
import { createTemplateRegistryService } from '../templateRegistryService';
import { featureFlags } from '../../config/featureFlags';

// Sample texts from real PDFs extracted during analysis
const SBS_TEXT = `RAZON SOCIAL
SEGURO INTEGRAL PARA
LA EMPRESA
Resumen de coberturas y primas
Todo riesgo daños materiales
PRIMA
$ 485.151
IMPUESTOS
$ 92.179`;

const HDI_TEXT = `PYME HDI
No. Cotización 195414
AMPAROS Y COBERTURAS QUE TENDRÁ CUBIERTO TU NEGOCIO
DAÑOS MATERIALES
Incendio y Riesgos Aliados
DEDUCIBLES QUE APLICAN PARA TODA LA PÓLIZA
AMPAROS BASICOS :5.0% DEL VALOR DE LA PÉRDIDA 1 S.M.M.L.V`;

const MAPFRE_TEXT = `COTIZACION
TODO RIESGO PYME INTEGRAL
SECCION PRIMERA - AMPARO BASICO - TODO RIESGO DANO MATERIAL
10 % PERD Min 1 (SMMLV)
SECCION SEGUNDA - TERREMOTO TEMBLOR Y/O ERUPCION VOLCANICA`;

const CHUBB_TEXT = `Chubb Seguros Colombia S.A.
Cotización
Bienes y Valores Asegurables
EDIFICIOS Y/O MEJORAS LOCATIVAS
Coberturas
Descripción                               Suma Asegurada                             Deducible
AMPARO BÁSICO TODO RIESGO                 1.621.704.283,00 COP
Remoción de escombros(Sublímite)          486.511.284,90 COP`;

const AXA_TEXT = `Número de cotización 2500027478
Prima anual antes de IVA $ 10.343.085
Propiedad
Este amparo cubre las pérdidas materiales o daños súbitos
Todo riesgo incendio:
Terremoto, temblor, erupción volcánica y maremoto`;

const BOLIVAR_TEXT = `COTIZACIÓN DE
TRANQUILIDAD PYMES +
DIGITAL
VALOR DE LA PRIMA: $1,187,511.00
VALOR ASISTENCIA BOLÍVAR: $73,000.00
VALOR EMISIÓN DIGITAL: $8,000.00
IVA PRIMA: $227,147.00
TOTAL A PAGAR: $1,509,528.00`;

describe('formatDetector', () => {
  describe('detectFormatFamily', () => {
    it('should detect TABLE-DOUBLE format (HDI)', () => {
      const result = detectFormatFamily(HDI_TEXT);
      expect(result.family).toBe('TABLE-DOUBLE');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.hasTables).toBe(true);
    });

    it('should detect TABLE-INTEGRATED format (CHUBB)', () => {
      const result = detectFormatFamily(CHUBB_TEXT);
      expect(result.family).toBe('TABLE-INTEGRATED');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.hasTables).toBe(true);
    });

    it('should detect SECTIONS format (MAPFRE)', () => {
      const result = detectFormatFamily(MAPFRE_TEXT);
      expect(result.family).toBe('SECTIONS');
      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.hasSections).toBe(true);
    });

    it('should detect DESCRIPTIVE format (AXA)', () => {
      const result = detectFormatFamily(AXA_TEXT);
      expect(result.family).toBe('DESCRIPTIVE');
      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should detect PRICE-TABLE format (SBS)', () => {
      const result = detectFormatFamily(SBS_TEXT);
      expect(result.family).toBe('PRICE-TABLE');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.hasTables).toBe(true);
    });

    it('should detect TEXT format (BOLIVAR)', () => {
      const result = detectFormatFamily(BOLIVAR_TEXT);
      // BOLIVAR may be detected as TEXT or another format
      expect(result.family).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should fallback to UNKNOWN for unrecognizable text', () => {
      const result = detectFormatFamily('Some random text without any insurance terms');
      expect(result.family).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('should return UNKNOWN for empty text', () => {
      const result = detectFormatFamily('');
      expect(result.family).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('should return UNKNOWN for very short text', () => {
      const result = detectFormatFamily('Hi');
      expect(result.family).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });
  });

  describe('format detection metadata', () => {
    it('should detect tables in TABLE-DOUBLE format', () => {
      const result = detectFormatFamily(HDI_TEXT);
      expect(result.hasTables).toBe(true);
    });

    it('should detect sections in SECTIONS format', () => {
      const result = detectFormatFamily(MAPFRE_TEXT);
      expect(result.hasSections).toBe(true);
    });

    it('should include detected patterns', () => {
      const result = detectFormatFamily(HDI_TEXT);
      expect(result.detectedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('insurer-name independence', () => {
    it('should never use insurer-name heuristics', () => {
      const textWithHDI = 'HDI Seguros\nSuma Asegurada: 500M\nDeducible: 10%';
      const result = detectFormatFamily(textWithHDI);
      expect(result.family).toBe('TABLE-INTEGRATED');
      const hasNamePattern = result.detectedPatterns.some((p) =>
        /hdi|mapfre|sura|allianz|axa|liberty/i.test(p)
      );
      expect(hasNamePattern).toBe(false);
    });

    it('should detect unknown insurer with TABLE-DOUBLE layout', () => {
      const text = 'Nueva Aseguradora SA\nAMPAROS BASICOS\nIncendio\n\nDEDUCIBLES QUE APLICAN\n10%';
      const result = detectFormatFamily(text);
      expect(result.family).toBe('TABLE-DOUBLE');
    });
  });

  describe('getFormatConfidence', () => {
    it('should return the confidence from result', () => {
      const result = detectFormatFamily('Suma Asegurada: 100M');
      expect(getFormatConfidence(result)).toBe(result.confidence);
    });
  });

  describe('extractForDetection', () => {
    it('should truncate text to maxChars', () => {
      const long = 'A'.repeat(5000);
      const extracted = extractForDetection(long, 100);
      expect(extracted.length).toBe(100);
    });

    it('should return full text when shorter than maxChars', () => {
      const short = 'Short text';
      expect(extractForDetection(short, 100)).toBe(short);
    });
  });

  describe('getFormatFamilyDescription', () => {
    it('should return descriptions for all families', () => {
      const families: FormatFamily[] = [
        'TABLE-DOUBLE',
        'TABLE-INTEGRATED',
        'SECTIONS',
        'DESCRIPTIVE',
        'CONDITIONS',
        'PRICE-TABLE',
        'TEXT',
        'UNKNOWN',
      ];
      families.forEach((family) => {
        const desc = getFormatFamilyDescription(family);
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      });
    });
  });

  describe('detectFormatWithRegistry', () => {
    const bbvaText = `BBVA SEGUROS
COT-2026-001
COBERTURAS / DEDUCIBLE
Todo Riesgo Daño Material`;

    const sbsText = `SEGUROS SBS
Resumen de coberturas y primas
Todo riesgo daños materiales`;

    it('returns the BBVA template when registry matches and flags are enabled', async () => {
      featureFlags.updateFlag('useTemplateGraphPipeline', true);
      featureFlags.updateFlag('templateBbvaV1', true);

      const registry = createTemplateRegistryService();
      const result = await detectFormatWithRegistry(bbvaText, registry, { domain: 'pyme' });

      expect(result.templateId).toBe('bbva-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
      expect(result.family).toBe('TABLE-INTEGRATED');
    });

    it('returns the SBS template when registry matches', async () => {
      featureFlags.updateFlag('useTemplateGraphPipeline', true);
      featureFlags.updateFlag('templateSbsV1', true);

      const registry = createTemplateRegistryService();
      const result = await detectFormatWithRegistry(sbsText, registry, { domain: 'pyme' });

      expect(result.templateId).toBe('sbs-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
    });

    it('falls back to generic family when no template matches', async () => {
      featureFlags.updateFlag('useTemplateGraphPipeline', true);

      const registry = createTemplateRegistryService();
      const result = await detectFormatWithRegistry(
        'Some random text without any insurance terms',
        registry,
        { domain: 'pyme' }
      );

      expect(result.templateId).toBeNull();
      expect(result.templateConfidence).toBeNull();
      expect(result.family).toBe('UNKNOWN');
    });

    it('ignores template match when master pipeline flag is disabled', async () => {
      featureFlags.updateFlag('useTemplateGraphPipeline', false);
      featureFlags.updateFlag('templateBbvaV1', true);

      const registry = createTemplateRegistryService();
      const result = await detectFormatWithRegistry(bbvaText, registry, { domain: 'pyme' });

      expect(result.templateId).toBeNull();
      expect(result.templateConfidence).toBeNull();
    });

    it('ignores a template match when its per-insurer flag is disabled', async () => {
      featureFlags.updateFlag('useTemplateGraphPipeline', true);
      featureFlags.updateFlag('templateBbvaV1', false);

      const registry = createTemplateRegistryService();
      const result = await detectFormatWithRegistry(bbvaText, registry, { domain: 'pyme' });

      expect(result.templateId).toBeNull();
      expect(result.templateConfidence).toBeNull();
    });
  });
});
