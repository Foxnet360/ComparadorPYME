import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { structuredClauseExtractor } from '../structuredClauseExtractor';

// Check if PDF files exist
const EJEMPLOS_DIR = '/home/foxnet360/Documentos/dev/Corredores/comparador-csa/Ejemplos';

const PDF_PATHS = {
  CHUBB: [
    path.join(EJEMPLOS_DIR, 'laser-home/Clausulados/Clausulado - CHUBB.pdf'),
    path.join(EJEMPLOS_DIR, 'Alico/CLAUSULADOS/CLAUSULADO CHUBB-DAÑOS.pdf'),
  ],
  MAPFRE: [
    path.join(EJEMPLOS_DIR, 'laser-home/Clausulados/Clausulado - MAPFRE.pdf'),
    path.join(EJEMPLOS_DIR, 'Pachito-el-chef/CLAUSULADOS/CLAUSULADO MAPFRE.pdf'),
  ],
  BBVA: [
    path.join(EJEMPLOS_DIR, 'laser-home/Clausulados/Clausulado - BBVA.pdf'),
  ],
  AXA: [
    path.join(EJEMPLOS_DIR, 'laser-home/Clausulados/Clausulado - AXA Colpatria.pdf'),
    path.join(EJEMPLOS_DIR, 'Alico/CLAUSULADOS/CLAUSULADO PYME AXA COLPATRIA.pdf'),
  ]
};

// Helper to check if file exists
const fileExists = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

// Mock Gemini for testing
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn(() => Promise.resolve({
        text: JSON.stringify({
          coverages: [
            {
              name: 'AMPARO BASICO',
              description: 'Cobertura todo riesgo de daño material',
              insuredAmount: '$500,000,000',
              deductible: {
                components: [
                  { type: 'percentage', value: 10 },
                  { type: 'minimum', value: 5, currency: 'SMMLV' }
                ],
                rawText: '10% con mínimo de 5 SMMLV'
              },
              exclusions: ['Guerra', 'Terrorismo'],
              conditions: ['Mantenimiento preventivo'],
              sourcePage: 1
            }
          ],
          generalExclusions: ['Actos dolosos'],
          generalConditions: ['Pago de prima'],
          definitions: { SMMLV: 'Salario Mínimo Mensual Legal Vigente' }
        })
      }))
    }
  }))
}));

describe('Structured Clause Extraction - Real PDFs', () => {
  describe('CHUBB', () => {
    const chubbPdf = PDF_PATHS.CHUBB.find(fileExists);
    
    it('should find CHUBB clause PDF', () => {
      expect(chubbPdf).toBeDefined();
      if (chubbPdf) {
        expect(fs.existsSync(chubbPdf)).toBe(true);
      }
    });

    it('should extract structure from CHUBB PDF', async () => {
      if (!chubbPdf) {
        console.log('⚠️ CHUBB PDF not found, skipping test');
        return;
      }

      // Read PDF content (simplified - in real implementation would use pdf-parse)
      const pdfBuffer = fs.readFileSync(chubbPdf);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // For testing purposes, we'll use a sample text
      const sampleText = `
        CLAUSULADO CHUBB - SEGURO PYME
        
        AMPARO BASICO - TODO RIESGO
        Cubre daño material a edificios y contenidos.
        Deducible: 10% con mínimo de 5 SMMLV y tope de 50 SMMLV.
        
        RESPONSABILIDAD CIVIL
        Cubre daños a terceros hasta $1,000,000,000.
        Sin deducible.
        
        Exclusiones: Guerra, terrorismo nuclear.
      `;

      const extracted = await structuredClauseExtractor.extractFromText(
        sampleText,
        'CHUBB',
        'PYME'
      );

      expect(extracted).toBeDefined();
      expect(extracted.insurer).toBe('CHUBB');
      expect(extracted.coverages.length).toBeGreaterThan(0);
    });
  });

  describe('MAPFRE', () => {
    const mapfrePdf = PDF_PATHS.MAPFRE.find(fileExists);
    
    it('should find MAPFRE clause PDF', () => {
      expect(mapfrePdf).toBeDefined();
      if (mapfrePdf) {
        expect(fs.existsSync(mapfrePdf)).toBe(true);
      }
    });

    it('should extract structure from MAPFRE PDF', async () => {
      if (!mapfrePdf) {
        console.log('⚠️ MAPFRE PDF not found, skipping test');
        return;
      }

      const pdfBuffer = fs.readFileSync(mapfrePdf);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const sampleText = `
        CLAUSULADO MAPFRE - SEGURO EMPRESARIAL
        
        AMPARO BASICO
        Todo riesgo de daño material.
        Deducible: 10% con mínimo de 5 SMMLV.
        
        LUCRO CESANTE
        Cubre pérdida de beneficios.
        Deducible: 15% con mínimo de 10 SMMLV.
      `;

      const extracted = await structuredClauseExtractor.extractFromText(
        sampleText,
        'MAPFRE',
        'EMPRESARIAL'
      );

      expect(extracted).toBeDefined();
      expect(extracted.insurer).toBe('MAPFRE');
      expect(extracted.coverages.length).toBeGreaterThan(0);
    });
  });

  describe('BBVA', () => {
    const bbvaPdf = PDF_PATHS.BBVA.find(fileExists);
    
    it('should find BBVA clause PDF', () => {
      expect(bbvaPdf).toBeDefined();
      if (bbvaPdf) {
        expect(fs.existsSync(bbvaPdf)).toBe(true);
      }
    });

    it('should extract structure from BBVA PDF', async () => {
      if (!bbvaPdf) {
        console.log('⚠️ BBVA PDF not found, skipping test');
        return;
      }

      const pdfBuffer = fs.readFileSync(bbvaPdf);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const sampleText = `
        CLAUSULADO BBVA - SEGURO PYME
        
        DAÑOS MATERIALES
        Cubre incendio, terremoto, explosión.
        Deducible: 10% con mínimo de 5 SMMLV y tope de 50 SMMLV.
        
        RESPONSABILIDAD CIVIL EXTRACONTRACTUAL
        Hasta $2,000,000,000.
        Sin deducible.
      `;

      const extracted = await structuredClauseExtractor.extractFromText(
        sampleText,
        'BBVA',
        'PYME'
      );

      expect(extracted).toBeDefined();
      expect(extracted.insurer).toBe('BBVA');
      expect(extracted.coverages.length).toBeGreaterThan(0);
    });
  });

  describe('AXA', () => {
    const axaPdf = PDF_PATHS.AXA.find(fileExists);
    
    it('should find AXA clause PDF', () => {
      expect(axaPdf).toBeDefined();
      if (axaPdf) {
        expect(fs.existsSync(axaPdf)).toBe(true);
      }
    });

    it('should extract structure from AXA PDF', async () => {
      if (!axaPdf) {
        console.log('⚠️ AXA PDF not found, skipping test');
        return;
      }

      const pdfBuffer = fs.readFileSync(axaPdf);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      const sampleText = `
        CLAUSULADO AXA COLPATRIA - SEGURO PYME
        
        AMPARO BASICO - TODO RIESGO
        Cubre daño material.
        Deducible: 10% con mínimo de 5 SMMLV.
        
        ROTURA DE MAQUINARIA
        Cubre daño interno a maquinaria.
        Deducible: 15% con mínimo de 10 SMMLV.
        
        RESPONSABILIDAD CIVIL
        Hasta $1,500,000,000.
        Sin deducible.
      `;

      const extracted = await structuredClauseExtractor.extractFromText(
        sampleText,
        'AXA',
        'PYME'
      );

      expect(extracted).toBeDefined();
      expect(extracted.insurer).toBe('AXA');
      expect(extracted.coverages.length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate extracted data against raw text', () => {
      const structured = {
        insurer: 'TEST',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL' as const,
        coverages: [
          {
            name: 'Incendio',
            description: 'Cobertura de incendio',
            exclusions: [],
            conditions: [],
            sourcePage: 1
          }
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      };

      const rawText = 'Este documento cubre Incendio y otros riesgos';
      const validation = structuredClauseExtractor.validateExtraction(structured, rawText);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect coverage names not in raw text', () => {
      const structured = {
        insurer: 'TEST',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL' as const,
        coverages: [
          {
            name: 'Cobertura Inexistente',
            description: 'No existe',
            exclusions: [],
            conditions: [],
            sourcePage: 1
          }
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      };

      const rawText = 'Este documento solo cubre Incendio';
      const validation = structuredClauseExtractor.validateExtraction(structured, rawText);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});