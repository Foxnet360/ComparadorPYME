import { describe, it, expect } from 'vitest';
import { semanticChunker } from '../semanticChunker';

describe('semanticChunker', () => {
  describe('detectStructure', () => {
    it('should detect chapters, sections, and clauses correctly', () => {
      const text = `
        CAPÍTULO I CONDICIONES GENERALES
        SECCIÓN I DEFINICIONES
        1.1 Asegurado
        ARTÍCULO 2 OBLIGACIONES
      `;
      const structure = semanticChunker.detectStructure(text);
      expect(structure).toHaveLength(4);
      expect(structure[0].type).toBe('chapter');
      expect(structure[1].type).toBe('section');
      expect(structure[2].type).toBe('clause');
      expect(structure[3].type).toBe('clause');
    });
  });

  describe('createChunks', () => {
    it('should create chunks from structured text', () => {
      const text = `
CAPÍTULO I GENERALES
SECCIÓN I OBJETO
1.1 Esta es la primera clausula que es lo suficientemente larga para ser considerada cincuenta caracteres en longitud total.
1.2 Y esta seria la segunda clausula que tambien debe superar la marca de los cincuenta caracteres.
      `;
      const metadata = { documentName: 'doc.pdf', insurerName: 'Insur' };
      const boundaries = [{ pageNumber: 1, charIndex: 0 }];
      
      const chunks = semanticChunker.createChunks(text, metadata, boundaries);
      expect(chunks.length).toBe(2);
      expect(chunks[0].metadata.chapter).toContain('CAPÍTULO I');
      expect(chunks[0].metadata.section).toContain('SECCIÓN I');
      expect(chunks[0].metadata.clauseId).toBe('1.1');
      expect(chunks[1].metadata.clauseId).toBe('1.2');
    });

    it('should return a single chunk for text with no structure', () => {
      const text = `Este texto no tiene capitulos ni secciones identificables.`;
      const chunks = semanticChunker.createChunks(text, {}, [{ pageNumber: 1, charIndex: 0 }]);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].id).toBe('full-doc');
    });
  });

  describe('getPageForCharIndex', () => {
    it('should return correct page for a given char index', () => {
      const boundaries = [
        { pageNumber: 1, charIndex: 0 },
        { pageNumber: 2, charIndex: 100 },
        { pageNumber: 3, charIndex: 200 },
      ];
      expect(semanticChunker.getPageForCharIndex(50, boundaries)).toBe(1);
      expect(semanticChunker.getPageForCharIndex(150, boundaries)).toBe(2);
      expect(semanticChunker.getPageForCharIndex(250, boundaries)).toBe(3);
    });
  });
});
