import { describe, it, expect } from 'vitest';
import { comparisonPromptBuilder, PromptContext } from '../comparisonPromptBuilder';

function buildV2Prompt(context: Partial<PromptContext> = {}, addons?: string[]) {
  return comparisonPromptBuilder.buildV2ComparisonPrompt(
    {
      insurerCount: 2,
      hasClauses: false,
      ...context,
    },
    addons
  );
}

describe('comparisonPromptBuilder', () => {
  it('includes the four flat row labels in the comparison prompt', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 3 });

    expect(prompt).toContain('Bienes Asegurados');
    expect(prompt).toContain('Deducibles');
    expect(prompt).toContain('Prima con IVA');
    expect(prompt).toContain('Forma de Pago');
  });

  it('requests JSON output with insurers and rows schema', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });

    expect(prompt).toContain('"insurers"');
    expect(prompt).toContain('"rows"');
    expect(prompt).toContain('"label"');
    expect(prompt).toContain('"cells"');
    expect(prompt).toContain('No informado');
  });

  it('does not include legacy canonical coverage categories', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });

    expect(prompt).not.toContain('Amparo Básico');
    expect(prompt).not.toContain('Terremoto');
    expect(prompt).not.toContain('Responsabilidad Civil Extracontractual');
  });

  it('includes the insurer count in the context', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 4 });

    expect(prompt).toContain('4 cotizaciones');
  });

  it('builds a correction prompt referencing the original response and error', () => {
    const correction = comparisonPromptBuilder.buildCorrectionPrompt('bad json', 'missing rows');

    expect(correction).toContain('bad json');
    expect(correction).toContain('missing rows');
    expect(correction).toContain('JSON');
  });
});

describe('comparisonPromptBuilder.buildV2ComparisonPrompt', () => {
  it('suggests granular business-section sub-rows (Bienes, Deducibles, Sustracción, Financiero)', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('BIENES ASEGURADOS');
    expect(prompt).toContain('Mercancías');
    expect(prompt).toContain('DEDUCIBLES');
    expect(prompt).toContain('Todo Riesgo Incendio');
    expect(prompt).toContain('SUSTRACCIÓN');
    expect(prompt).toContain('Sustracción con Violencia');
    expect(prompt).toContain('FINANCIAL');
  });

  it('requests a section-aware comparison table with insurers and rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('insurers');
    expect(prompt).toContain('rows');
    expect(prompt).toContain('section');
    expect(prompt).toContain('cells');
  });

  it('explicitly allows the LLM to omit, add, or rename rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('omit');
    expect(prompt).toContain('renombrar');
  });

  it('includes deductible sub-rows as a structured example', () => {
    const prompt = buildV2Prompt();

    expect(prompt.toLowerCase()).toContain('deducible');
  });

  it('includes the insurer count in the context', () => {
    const prompt = buildV2Prompt({ insurerCount: 4 });

    expect(prompt).toContain('4 cotizaciones');
  });

  it('does not enforce exactly four rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).not.toContain('EXACTAMENTE estas filas');
  });

  it('appends insurer-specific template addons when provided', () => {
    const prompt = buildV2Prompt({}, [
      'BBVA: Extrae deducibles de la columna 3 de la tabla.',
      'SBS: Usa los nombres de cobertura exactos del resumen SBS.',
    ]);

    expect(prompt).toContain('BBVA:');
    expect(prompt).toContain('SBS:');
    expect(prompt).toContain('Extrae deducibles de la columna 3');
    expect(prompt.indexOf('BBVA:')).toBeGreaterThan(prompt.indexOf('filas agrupadas por sección'));
  });

  it('keeps the generic prompt when no addons are provided', () => {
    const generic = buildV2Prompt();
    const withEmptyAddons = buildV2Prompt({}, []);

    expect(withEmptyAddons).toBe(generic);
  });

  describe('correction prompts without arbitrary truncation', () => {
    it('preserves full response beyond 1000 characters in buildV2CorrectionPrompt', () => {
      const longPayload = 'A'.repeat(2500);
      const prompt = comparisonPromptBuilder.buildV2CorrectionPrompt(longPayload, 'SyntaxError');

      expect(prompt).toContain(longPayload);
      expect(prompt).toContain('RESPUESTA ANTERIOR:\n' + longPayload);
      expect(prompt).not.toContain('(parcial)');
    });

    it('preserves full response beyond 1000 characters in buildCorrectionPrompt', () => {
      const longPayload = 'B'.repeat(2500);
      const prompt = comparisonPromptBuilder.buildCorrectionPrompt(longPayload, 'InvalidSchema');

      expect(prompt).toContain(longPayload);
      expect(prompt).toContain('RESPUESTA ANTERIOR:\n' + longPayload);
      expect(prompt).not.toContain('(parcial)');
    });

    it('generates domain-specific sections and percentage resolution rule for hogar', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 3 },
        undefined,
        'hogar'
      );

      expect(prompt).toContain('Hogar y Vivienda');
      expect(prompt).toContain('Edificio / Estructura');
      expect(prompt).toContain('Contenidos / Muebles y Enseres');
      expect(prompt).toContain('REGLA CRÍTICA DE AMPAROS PORCENTUALES');
      expect(prompt).toContain('REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS');
      expect(prompt).toContain('No Cotizado');
      expect(prompt).toContain('Sin deducible');
    });

    it('generates domain-specific sections and rules for copropiedades', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 3 },
        undefined,
        'copropiedades'
      );

      expect(prompt).toContain('Copropiedades y Propiedad Horizontal en Colombia (Ley 675 de 2001');
      expect(prompt).toContain('BIENES Y ÁREAS COMUNES (LEY 675)');
      expect(prompt).toContain('RCE Directores y Administradores (D&O Copropiedades)');
      expect(prompt).toContain('REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS');
    });

    it('generates domain-specific sections and rules for autos', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 2 },
        undefined,
        'autos'
      );

      expect(prompt).toContain('Automotores y Vehículos en Colombia bajo regulación de la SFC y FASECOLDA');
      expect(prompt).toContain('DATOS DEL VEHÍCULO Y BIENES');
      expect(prompt).toContain('Vehículo Asegurado (Marca / Modelo / Año / Placa)');
      expect(prompt).toContain('Límite Único Combinado (LUC) RCE');
      expect(prompt).toContain('Pérdida Parcial por Daños (PPD)');
      expect(prompt).toContain('Carro Taller y Asistencia Mecánica Ligera');
      expect(prompt).toContain('REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS');
    });

    it('generates domain-specific sections and rules for salud', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 2 },
        undefined,
        'salud'
      );

      expect(prompt).toContain('Planes Voluntarios de Salud (PVS) y Medicina Prepagada en Colombia');
      expect(prompt).toContain('MODALIDAD Y RED DE ATENCIÓN');
      expect(prompt).toContain('Tipo de Plan (Complementario PBS / Sustitutivo)');
      expect(prompt).toContain('Hospitalización en Habitación Individual');
      expect(prompt).toContain('Copago por Consulta Médica Especializada');
      expect(prompt).toContain('Períodos de Carencia');
    });

    it('generates domain-specific sections and rules for cumplimiento', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 2 },
        undefined,
        'cumplimiento'
      );

      expect(prompt).toContain('Seguros de Cumplimiento, Fianzas y Contratación Estatal en Colombia');
      expect(prompt).toContain('DATOS DEL CONTRATO GARANTIZADO');
      expect(prompt).toContain('Seriedad de la Oferta (% y Límite)');
      expect(prompt).toContain('Buen Manejo y Correcta Inversión del Anticipo (100%)');
      expect(prompt).toContain('Pago de Salarios, Prestaciones Sociales e Indemnizaciones');
    });

    it('generates domain-specific sections and rules for transporte', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 2 },
        undefined,
        'transporte'
      );

      expect(prompt).toContain('Seguros de Transporte de Mercancías y Carga en Colombia');
      expect(prompt).toContain('TRAYECTO Y MERCANCÍAS');
      expect(prompt).toContain('Avería Gruesa (General Average)');
      expect(prompt).toContain('Cláusulas ICC del Instituto de Londres');
      expect(prompt).toContain('requisitos obligatorios de seguridad');
    });

    it('generates domain-specific sections and rules for vida_grupo', () => {
      const prompt = comparisonPromptBuilder.buildV2ComparisonPrompt(
        { insurerCount: 2 },
        undefined,
        'vida_grupo'
      );

      expect(prompt).toContain('Seguros de Vida Grupo y Vida Colectivo en Colombia');
      expect(prompt).toContain('DATOS DEL GRUPO Y ASEGURABILIDAD');
      expect(prompt).toContain('Incapacidad Total y Permanente (ITP ≥ 50%)');
      expect(prompt).toContain('IVA (0% exento en vida bajo Art. 427 Estatuto Tributario)');
    });

    it('enforces corporate insurer naming and prohibits client/product concatenation in pyme and hogar', () => {
      const pymePrompt = comparisonPromptBuilder.buildV2ComparisonPrompt({ insurerCount: 2 });
      expect(pymePrompt).toContain('REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS');
      expect(pymePrompt).toContain('ALLIANZ');

      const flatPrompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });
      expect(flatPrompt).toContain('REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS');
    });
  });
});


