
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
    console.error("No API KEY found");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        console.log("Fetching models with API KEY length:", apiKey.length);
        // Note: The SDK doesn't have a direct 'listModels' on the main class in some versions, 
        // but let's try via the model manager or just assume standard error if it fails.
        // Actually, the SDK exposes it via `getGenerativeModel`? No.
        // We can't easily list models with the high-level SDK unless we use the lower level one or make a fetch.
        // Let's use a raw fetch to be sure.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: any) => {
                if (m.name.includes("gemini")) {
                    console.log(`- ${m.name} (${m.displayName}) - Supported generation methods: ${m.supportedGenerationMethods}`);
                }
            });
        } else {
            console.error("Error listing models:", data);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
