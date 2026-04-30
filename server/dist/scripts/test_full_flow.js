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
const gemini_1 = require("../services/gemini");
const schemas_1 = require("../constants/schemas");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load env
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env.local') });
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}
// Mock file creation for testing
const MOCK_DIR = path_1.default.resolve(__dirname, '../../test_mocks');
if (!fs_1.default.existsSync(MOCK_DIR)) {
    fs_1.default.mkdirSync(MOCK_DIR);
}
const createMockPdf = (name) => {
    const filePath = path_1.default.join(MOCK_DIR, name);
    fs_1.default.writeFileSync(filePath, "Dummy PDF Content for Testing: " + name);
    return {
        path: filePath,
        mimetype: 'application/pdf',
        originalname: name
    };
};
function testFullFlow() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting Isolation Test for Full Analysis Flow...");
        try {
            // 1. Create Dummy Files
            const quoteFile = createMockPdf("test_quote.pdf");
            const clauseFile = createMockPdf("test_clause.pdf");
            console.log("1. Uploading Quote...");
            const uploadedQuote = yield gemini_1.geminiService.uploadFile(quoteFile.path, quoteFile.mimetype, quoteFile.originalname);
            console.log("   Quote Uploaded:", uploadedQuote.name);
            console.log("2. Uploading Clause...");
            const uploadedClause = yield gemini_1.geminiService.uploadFile(clauseFile.path, clauseFile.mimetype, clauseFile.originalname);
            console.log("   Clause Uploaded:", uploadedClause.name);
            console.log("3. Waiting for processing...");
            yield gemini_1.geminiService.waitForFilesActive([uploadedQuote, uploadedClause]);
            console.log("   Files Active.");
            console.log("4. Analyzing...");
            const result = yield gemini_1.geminiService.analyzeQuotes([uploadedQuote], [uploadedClause], "Test prompt: Analyze this dummy data.", schemas_1.ANALYSIS_SCHEMA);
            console.log("5. Analysis Result Received!");
            console.log(JSON.stringify(result, null, 2));
        }
        catch (error) {
            console.error("FATAL ERROR IN ISOLATION TEST:");
            console.error(error);
        }
    });
}
testFullFlow();
