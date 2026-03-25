
import { geminiService } from '../services/gemini';
import { ANALYSIS_SCHEMA } from '../constants/schemas';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

// Mock file creation for testing
const MOCK_DIR = path.resolve(__dirname, '../../test_mocks');
if (!fs.existsSync(MOCK_DIR)) {
    fs.mkdirSync(MOCK_DIR);
}

const createMockPdf = (name: string) => {
    const filePath = path.join(MOCK_DIR, name);
    fs.writeFileSync(filePath, "Dummy PDF Content for Testing: " + name);
    return {
        path: filePath,
        mimetype: 'application/pdf',
        originalname: name
    };
};

async function testFullFlow() {
    console.log("Starting Isolation Test for Full Analysis Flow...");
    try {
        // 1. Create Dummy Files
        const quoteFile = createMockPdf("test_quote.pdf");
        const clauseFile = createMockPdf("test_clause.pdf");

        console.log("1. Uploading Quote...");
        const uploadedQuote = await geminiService.uploadFile(quoteFile.path, quoteFile.mimetype, quoteFile.originalname);
        console.log("   Quote Uploaded:", uploadedQuote.name);

        console.log("2. Uploading Clause...");
        const uploadedClause = await geminiService.uploadFile(clauseFile.path, clauseFile.mimetype, clauseFile.originalname);
        console.log("   Clause Uploaded:", uploadedClause.name);

        console.log("3. Waiting for processing...");
        await geminiService.waitForFilesActive([uploadedQuote, uploadedClause]);
        console.log("   Files Active.");

        console.log("4. Analyzing...");
        const result = await geminiService.analyzeQuotes(
            [uploadedQuote],
            [uploadedClause],
            "Test prompt: Analyze this dummy data.",
            ANALYSIS_SCHEMA
        );

        console.log("5. Analysis Result Received!");
        console.log(JSON.stringify(result, null, 2));

    } catch (error: any) {
        console.error("FATAL ERROR IN ISOLATION TEST:");
        console.error(error);
    }
}

testFullFlow();
