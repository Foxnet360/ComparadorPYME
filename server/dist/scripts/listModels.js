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
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env.local') });
const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
if (!apiKey) {
    console.error("No API KEY found");
    process.exit(1);
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
function listModels() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Fetching models with API KEY length:", apiKey.length);
            // Note: The SDK doesn't have a direct 'listModels' on the main class in some versions, 
            // but let's try via the model manager or just assume standard error if it fails.
            // Actually, the SDK exposes it via `getGenerativeModel`? No.
            // We can't easily list models with the high-level SDK unless we use the lower level one or make a fetch.
            // Let's use a raw fetch to be sure.
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = yield fetch(url);
            const data = yield response.json();
            if (data.models) {
                console.log("Available Models:");
                data.models.forEach((m) => {
                    if (m.name.includes("gemini")) {
                        console.log(`- ${m.name} (${m.displayName}) - Supported generation methods: ${m.supportedGenerationMethods}`);
                    }
                });
            }
            else {
                console.error("Error listing models:", data);
            }
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
listModels();
