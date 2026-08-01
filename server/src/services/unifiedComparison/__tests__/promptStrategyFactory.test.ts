import { describe, it, expect } from 'vitest';
import { getStrategy, promptStrategyFactory } from '../promptStrategyFactory';
import { InsuranceDomain } from '../../../types/domain';
import {
  buildPromptForFamily as buildPymePromptForFamily,
  buildTemplatePrompt as buildPymeTemplatePrompt,
  getSupportedFormatFamilies,
} from '../../promptBuilder.base';
import { FormatFamily } from '../../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../../schemas/templateRegistrySchema';

describe('promptStrategyFactory', () => {
  it('returns the pyme strategy for pyme domain', () => {
    const strategy = getStrategy('pyme');
    expect(strategy).toBeDefined();
    expect(typeof strategy.buildPromptForFamily).toBe('function');
    expect(typeof strategy.buildTemplatePrompt).toBe('function');
    expect(typeof strategy.buildCorrectionPrompt).toBe('function');
    expect(typeof strategy.getResponseSchema).toBe('function');
  });

  it('returns the autos strategy for autos domain', () => {
    const strategy = getStrategy('autos');
    const prompt = strategy.buildPromptForFamily('TABLE-INTEGRATED');
    expect(prompt).toContain('AUTOS');
    expect(prompt).toContain('Responsabilidad Civil Extracontractual Vehicular');
  });

  it('falls back to pyme for unknown domains', () => {
    const strategy = getStrategy('salud' as InsuranceDomain);
    const prompt = strategy.buildPromptForFamily('TABLE-INTEGRATED');
    const baseline = buildPymePromptForFamily('TABLE-INTEGRATED');
    expect(prompt).toBe(baseline);
  });

  it('exposes the same strategies through the object-style factory', () => {
    expect(promptStrategyFactory.getStrategy('pyme')).toBe(getStrategy('pyme'));
    expect(promptStrategyFactory.getStrategy('autos')).toBe(getStrategy('autos'));
  });
});

describe('pymePromptStrategy', () => {
  it('produces byte-identical prompts for every supported format family', () => {
    for (const family of getSupportedFormatFamilies()) {
      const strategy = getStrategy('pyme');
      const viaFactory = strategy.buildPromptForFamily(family as FormatFamily, {
        pageCount: 3,
        hasTables: true,
        insurerName: 'Genérica',
        formatFamily: family,
      });
      const baseline = buildPymePromptForFamily(family as FormatFamily, {
        pageCount: 3,
        hasTables: true,
        insurerName: 'Genérica',
        formatFamily: family,
      });
      expect(viaFactory).toBe(baseline);
    }
  });

  it('produces a byte-identical template prompt', () => {
    const template: TemplateRegistryEntry = {
      templateId: 'bbva-pyme-v1',
      insurer: 'BBVA',
      displayName: 'BBVA PYME',
      version: 1,
      fingerprints: {
        textMarkers: ['BBVA SEGUROS'],
        layoutMarkers: [],
        minConfidence: 90,
      },
      schema: {
        type: 'object',
        required: ['coverages'],
        properties: {
          coverages: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
      extractionHints: {
        coverageTablePage: 1,
        deductibleColumnIndex: 2,
      },
      promptAddon: 'Extraer primas de la columna 3.',
    };

    const tables: LayoutTable[] = [
      {
        page: 1,
        bounds: { x: 0, y: 0, width: 500, height: 200 },
        headers: [
          { text: 'Cobertura', x: 0, y: 0, width: 100, height: 12 },
          { text: 'Suma Asegurada', x: 100, y: 0, width: 100, height: 12 },
          { text: 'Deducible', x: 200, y: 0, width: 100, height: 12 },
        ],
        rows: [
          [
            { text: 'Incendio', x: 0, y: 20, width: 100, height: 12 },
            { text: '$500M', x: 100, y: 20, width: 100, height: 12 },
            { text: '10%', x: 200, y: 20, width: 100, height: 12 },
          ],
        ],
      },
    ];

    const strategy = getStrategy('pyme');
    const viaFactory = strategy.buildTemplatePrompt('bbva-pyme-v1', template, tables);
    const baseline = buildPymeTemplatePrompt('bbva-pyme-v1', template, tables);
    expect(viaFactory).toBe(baseline);
  });

  it('returns a structured JSON schema for pyme extraction', () => {
    const schema = getStrategy('pyme').getResponseSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('insurerName');
    expect(schema.properties).toHaveProperty('rawCoverages');
  });
});

describe('autosPromptStrategy', () => {
  it('includes autos-specific extraction fields', () => {
    const strategy = getStrategy('autos');
    const prompt = strategy.buildPromptForFamily('TABLE-INTEGRATED');

    expect(prompt).toContain('seguros de AUTOS');
    expect(prompt).toContain('Responsabilidad Civil Extracontractual Vehicular');
    expect(prompt).toContain('Pérdida Total');
    expect(prompt).toContain('Pérdida Parcial');
    expect(prompt).toContain('Carro Taller');
    expect(prompt).toContain('Asistencia en Viaje');
    expect(prompt).toContain('deducibles');
    expect(prompt).toContain('SMMLV');
    expect(prompt).toContain('días de inmovilización');
    expect(prompt).toContain('% del siniestro');
  });

  it('does not contain PYME-specific canonical coverage labels', () => {
    const strategy = getStrategy('autos');
    const prompt = strategy.buildPromptForFamily('TABLE-DOUBLE');

    expect(prompt).not.toContain('Incendio y Riesgos Aliados');
    expect(prompt).not.toContain('Todo Riesgo Daño Material');
    expect(prompt).not.toContain('Asistencia PYME');
  });

  it('includes context hints when provided', () => {
    const strategy = getStrategy('autos');
    const prompt = strategy.buildPromptForFamily('TEXT', {
      pageCount: 5,
      hasTables: true,
      insurerName: 'SBS',
      formatFamily: 'TEXT',
    });

    expect(prompt).toContain('5 páginas');
    expect(prompt).toContain('SBS');
    expect(prompt).toContain('Format family: TEXT');
  });

  it('returns a looser JSON schema that allows additional properties', () => {
    const schema = getStrategy('autos').getResponseSchema();
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(true);
    expect(schema.properties).toHaveProperty('rceLimit');
    expect(schema.properties).toHaveProperty('ptPpDetails');
    expect(schema.properties).toHaveProperty('carroTaller');
    expect(schema.properties).toHaveProperty('asistenciaViaje');
    expect(schema.properties).toHaveProperty('deducibles');
  });

  it('builds a template-aware autos prompt using template metadata', () => {
    const template: TemplateRegistryEntry = {
      templateId: 'sbs-autos-v1',
      insurer: 'SBS',
      displayName: 'SBS Autos',
      version: 1,
      fingerprints: {
        textMarkers: ['SBS SEGUROS'],
        layoutMarkers: [],
        minConfidence: 90,
      },
      schema: {
        type: 'object',
        required: ['coverages'],
        properties: { coverages: { type: 'array', items: { type: 'object' } } },
      },
      extractionHints: { coverageTablePage: 1, deductibleColumnIndex: 2 },
      promptAddon: 'Extraer deducibles de autos.',
    };

    const tables: LayoutTable[] = [
      {
        page: 1,
        bounds: { x: 0, y: 0, width: 500, height: 200 },
        headers: [
          { text: 'Cobertura', x: 0, y: 0, width: 100, height: 12 },
          { text: 'Límite', x: 100, y: 0, width: 100, height: 12 },
          { text: 'Deducible', x: 200, y: 0, width: 100, height: 12 },
        ],
        rows: [
          [
            { text: 'RC', x: 0, y: 20, width: 100, height: 12 },
            { text: '$1.2M', x: 100, y: 20, width: 100, height: 12 },
            { text: 'No aplica', x: 200, y: 20, width: 100, height: 12 },
          ],
        ],
      },
    ];

    const strategy = getStrategy('autos');
    const prompt = strategy.buildTemplatePrompt('sbs-autos-v1', template, tables);
    expect(prompt).toContain('SBS');
    expect(prompt).toContain('sbs-autos-v1');
    expect(prompt).toContain('AUTOS');
  });
});

describe('copropiedadesPromptStrategy', () => {
  it('includes copropiedades-specific extraction fields and Ley 675 references', () => {
    const strategy = getStrategy('copropiedades');
    const prompt = strategy.buildPromptForFamily('TABLE-INTEGRATED');

    expect(prompt).toContain('COPROPIEDADES');
    expect(prompt).toContain('Ley 675');
    expect(prompt).toContain('Incendio y Terremoto sobre Bienes Comunes');
    expect(prompt).toContain('Responsabilidad Civil Extracontractual Áreas Comunes');
    expect(prompt).toContain('RC Directores y Administradores');
    expect(prompt).toContain('Equipo Eléctrico y Maquinaria');
    expect(prompt).toContain('Daños por Agua');
  });

  it('returns a structured JSON schema for copropiedades extraction', () => {
    const schema = getStrategy('copropiedades').getResponseSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('insurerName');
    expect(schema.properties).toHaveProperty('ley675Compliance');
    expect(schema.properties).toHaveProperty('rawCoverages');
  });
});

describe('vidaGrupoPromptStrategy', () => {
  it('includes vida_grupo-specific extraction fields and suicide/age rules', () => {
    const strategy = getStrategy('vida_grupo');
    const prompt = strategy.buildPromptForFamily('TABLE-INTEGRATED');

    expect(prompt).toContain('VIDA GRUPO');
    expect(prompt).toContain('Amparo Básico por Muerte');
    expect(prompt).toContain('Incapacidad Total y Permanente');
    expect(prompt).toContain('Cobertura de Suicidio');
    expect(prompt).toContain('Auxilio Educativo');
  });

  it('returns a structured JSON schema for vida_grupo extraction', () => {
    const schema = getStrategy('vida_grupo').getResponseSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('insurerName');
    expect(schema.properties).toHaveProperty('groupDetails');
    expect(schema.properties).toHaveProperty('suicideCoverage');
    expect(schema.properties).toHaveProperty('rawCoverages');
  });
});
