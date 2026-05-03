"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const semanticChunker_1 = require("../semanticChunker");
const pdfExtractor_1 = require("../pdfExtractor");
const path_1 = __importDefault(require("path"));
(0, vitest_1.describe)('semanticChunker E2E', () => {
    (0, vitest_1.it)('should chunk the sample clause PDF', () => __awaiter(void 0, void 0, void 0, function* () {
        const clausePath = path_1.default.resolve(__dirname, '../../../test_mocks/test_clause.pdf');
        const result = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(clausePath);
        // Simulate boundaries for a single test chunk
        const pageBoundaries = [{ pageNumber: 1, charIndex: 0 }];
        const chunks = semanticChunker_1.semanticChunker.createChunks(result.text, {
            documentName: 'AXA COLPATRIA',
            insurerName: 'AXA',
        }, pageBoundaries);
        (0, vitest_1.expect)(chunks.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(chunks[0].content).toBeDefined();
        // Some basic expectation if it has chapters/sections
        if (chunks.length > 1) {
            // Assert there are chunks created out of structure
            const structuredChunk = chunks.find(c => c.metadata.clauseId || c.metadata.section);
            (0, vitest_1.expect)(structuredChunk).toBeDefined();
        }
    }), 30000);
});
