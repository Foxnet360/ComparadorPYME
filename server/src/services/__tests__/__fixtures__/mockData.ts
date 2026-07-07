// Mock data for testing

export const mockQuote = {
  insurerName: 'Seguros Bolívar',
  policyName: 'Empresarial Plus',
  priceAnnual: 8500000,
  currency: 'COP',
  coverages: [
    {
      name: 'Incendio (Edificio y Contenidos)',
      canonicalName: 'Incendio (Edificio y Contenidos)',
      value: '500000000',
      deductible: '10%',
    },
    {
      name: 'Responsabilidad Civil (RCE)',
      canonicalName: 'Responsabilidad Civil (RCE)',
      value: '100000000',
      deductible: '5 SMMLV',
    },
    {
      name: 'Lucro Cesante',
      canonicalName: 'Lucro Cesante',
      value: '100000000',
      deductible: 'No aplica',
    },
    {
      name: 'Cobertura Fantasma',
      canonicalName: 'Cobertura Fantasma',
      value: '1000000',
      deductible: '10%',
    },
  ],
  specialConditions: [],
  rawText: 'Mock quote text',
  parseConfidence: 95,
};

export const mockQuoteWithoutClauses = {
  ...mockQuote,
  insurerName: 'Aseguradora Sin Clausulado',
};

export const mockClientProfile = {
  industryType: 'manufactura' as const,
  locationCity: 'Cartagena',
  locationZone: 'costera' as const,
  hasSingleSupplier: true,
  employeeCount: 150,
  buildingType: 'propio' as const,
  primaryActivity: 'Fabricación de alimentos',
  annualRevenue: 2000000000,
};

export const mockClientProfileMountain = {
  ...mockClientProfile,
  locationCity: 'Bogotá',
  locationZone: 'montana' as const,
};

export const mockClauseCoverages = [
  {
    coverage_name: 'Incendio (Edificio y Contenidos)',
    is_mandatory: true,
    deductible_text: '10%',
    page_number: 5,
  },
  {
    coverage_name: 'Responsabilidad Civil (RCE)',
    is_mandatory: true,
    deductible_text: '5 SMMLV',
    page_number: 8,
  },
  {
    coverage_name: 'Lucro Cesante',
    is_mandatory: true,
    deductible_text: 'No aplica',
    page_number: 12,
  },
  {
    coverage_name: 'Sustracción / Hurto',
    is_mandatory: false,
    deductible_text: '10%',
    page_number: 15,
  },
];

export const mockExclusions = [
  'No cubre inundación en zonas costeras',
  'No cubre terremoto',
  'No cubre daños por construcción adyacente',
  'No cubre falla de proveedor único',
];

export const mockConditions = [
  'Presentar certificado de bomberos vigente',
  'Mantener sistema de alarma conectado 24/7',
  'Inspección trimestral por perito autorizado',
  'Constituir fianza de cumplimiento del 20% del valor asegurado',
];

export const mockDeductibleScenarios = [
  {
    name: 'Incendio',
    quoteDeductible: '5%',
    clauseDeductible: '5% / Máx. 500 SMMLV',
    insuredAmount: 500000000,
    expectedRisk: 'LOW',
  },
  {
    name: 'RC',
    quoteDeductible: '5 SMMLV',
    clauseDeductible: '5 SMMLV',
    insuredAmount: 100000000,
    expectedRisk: 'LOW',
  },
  {
    name: 'Terremoto',
    quoteDeductible: '20%',
    clauseDeductible: '20%',
    insuredAmount: 500000000,
    expectedRisk: 'HIGH',
  },
  {
    name: 'Con tope',
    quoteDeductible: '12%',
    clauseDeductible: '12% / Máx. 300 SMMLV',
    insuredAmount: 1000000000,
    expectedRisk: 'MEDIUM',
  },
];
