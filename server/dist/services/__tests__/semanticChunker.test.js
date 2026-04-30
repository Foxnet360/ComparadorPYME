"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const semanticChunker_1 = require("../semanticChunker");
(0, vitest_1.describe)('semanticChunker', () => {
    (0, vitest_1.describe)('detectStructure', () => {
        (0, vitest_1.it)('should detect chapters, sections, and clauses correctly', () => {
            const text = `
        CAPÍTULO I CONDICIONES GENERALES
        SECCIÓN I DEFINICIONES
        1.1 Asegurado
        ARTÍCULO 2 OBLIGACIONES
      `;
            const structure = semanticChunker_1.semanticChunker.detectStructure(text);
            (0, vitest_1.expect)(structure).toHaveLength(4);
            (0, vitest_1.expect)(structure[0].type).toBe('chapter');
            (0, vitest_1.expect)(structure[1].type).toBe('section');
            (0, vitest_1.expect)(structure[2].type).toBe('clause');
            (0, vitest_1.expect)(structure[3].type).toBe('clause');
        });
    });
    (0, vitest_1.describe)('createChunks', () => {
        (0, vitest_1.it)('should create chunks from structured text', () => {
            const text = `
CAPÍTULO I GENERALES
SECCIÓN I OBJETO
1.1 Esta es la primera clausula que es lo suficientemente larga para ser considerada cincuenta caracteres en longitud total.
1.2 Y esta seria la segunda clausula que tambien debe superar la marca de los cincuenta caracteres.
      `;
            const metadata = { documentName: 'doc.pdf', insurerName: 'Insur' };
            const boundaries = [{ pageNumber: 1, charIndex: 0 }];
            const chunks = semanticChunker_1.semanticChunker.createChunks(text, metadata, boundaries);
            (0, vitest_1.expect)(chunks.length).toBe(2);
            (0, vitest_1.expect)(chunks[0].metadata.chapter).toContain('CAPÍTULO I');
            (0, vitest_1.expect)(chunks[0].metadata.section).toContain('SECCIÓN I');
            (0, vitest_1.expect)(chunks[0].metadata.clauseId).toBe('1.1');
            (0, vitest_1.expect)(chunks[1].metadata.clauseId).toBe('1.2');
        });
        (0, vitest_1.it)('should return a single chunk for text with no structure', () => {
            const text = `Este texto no tiene capitulos ni secciones identificables.`;
            const chunks = semanticChunker_1.semanticChunker.createChunks(text, {}, [{ pageNumber: 1, charIndex: 0 }]);
            (0, vitest_1.expect)(chunks).toHaveLength(1);
            (0, vitest_1.expect)(chunks[0].id).toBe('full-doc');
        });
    });
    (0, vitest_1.describe)('getPageForCharIndex', () => {
        (0, vitest_1.it)('should return correct page for a given char index', () => {
            const boundaries = [
                { pageNumber: 1, charIndex: 0 },
                { pageNumber: 2, charIndex: 100 },
                { pageNumber: 3, charIndex: 200 },
            ];
            (0, vitest_1.expect)(semanticChunker_1.semanticChunker.getPageForCharIndex(50, boundaries)).toBe(1);
            (0, vitest_1.expect)(semanticChunker_1.semanticChunker.getPageForCharIndex(150, boundaries)).toBe(2);
            (0, vitest_1.expect)(semanticChunker_1.semanticChunker.getPageForCharIndex(250, boundaries)).toBe(3);
        });
    });
});
