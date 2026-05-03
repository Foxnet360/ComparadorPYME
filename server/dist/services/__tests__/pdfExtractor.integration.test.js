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
const pdfExtractor_1 = require("../pdfExtractor");
const path_1 = __importDefault(require("path"));
(0, vitest_1.describe)('pdfExtractor E2E', () => {
    (0, vitest_1.it)('should extract text from sample clause PDF', () => __awaiter(void 0, void 0, void 0, function* () {
        const clausePath = path_1.default.resolve(__dirname, '../../../test_mocks/test_clause.pdf');
        const result = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(clausePath);
        (0, vitest_1.expect)(result.text.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.metadata.pageCount).toBeGreaterThan(0);
    }), 30000);
    (0, vitest_1.it)('should extract text from sample quote PDF', () => __awaiter(void 0, void 0, void 0, function* () {
        const quotePath = path_1.default.resolve(__dirname, '../../../test_mocks/test_quote.pdf');
        const result = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(quotePath);
        (0, vitest_1.expect)(result.text.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.metadata.pageCount).toBeGreaterThan(0);
    }), 30000);
});
