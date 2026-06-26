
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
    console.error("No API KEY found");
    process.exit(1);
}

interface ModelEntry {
    name: string;
    displayName: string;
    supportedGenerationMethods: string[];
}

interface ModelsResponse {
    models?: ModelEntry[];
    error?: Record<string, unknown>;
}

async function listModels() {
    try {
        console.log("Fetching models with API KEY length:", apiKey.length);

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as ModelsResponse;

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach((m: ModelEntry) => {
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
