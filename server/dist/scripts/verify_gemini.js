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
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const generative_ai_1 = require("@google/generative-ai");
// Load environment variables
const envPath = path_1.default.resolve(__dirname, '../../../.env.local');
console.log(`Loading env from: ${envPath}`);
const result = dotenv_1.default.config({ path: envPath });
if (result.error) {
    console.warn("⚠️ Dotenv error:", result.error.message);
}
else {
    console.log("✅ Dotenv loaded successfully.");
}
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY is not set.");
    process.exit(1);
}
console.log(`🔑 API Key found (${apiKey.substring(0, 5)}...)`);
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
function verify() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("🔄 Testing Gemini API connection...");
            const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
            const prompt = "Explain what an actuary does in one sentence.";
            console.log(`📤 Sending prompt: "${prompt}"`);
            const result = yield model.generateContent(prompt);
            const response = yield result.response;
            const text = response.text();
            if (text) {
                console.log("\n✅ Gemini API is working correctly!");
                console.log(`📝 Response: ${text}`);
            }
            else {
                console.error("❌ Received empty response from Gemini.");
            }
        }
        catch (error) {
            if (error.message.includes("404") && error.message.includes("models/gemini-2.5-flash")) {
                console.log("⚠️ 'models/gemini-2.5-flash' not found. Retrying with 'gemini-pro'...");
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
                    const result = yield model.generateContent("Hello");
                    console.log("✅ Main model failed, but 'gemini-pro' works!");
                    return;
                }
                catch (retryError) {
                    console.error("❌ 'gemini-pro' also failed.");
                }
            }
            console.error("\n❌ Gemini API Verification FAILED (Detail):");
            if (error.status)
                console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            if (error.message.includes("404")) {
                console.error("👉 Tip: Check if the model 'models/gemini-2.5-flash' is available for your API key or region.");
                // List available models
                /*
                // Note: ensure the SDK version supports listModels or use REST API
                // For now, let's try a common fallback or just suggest checking docs
                */
            }
            if (error.message.includes("429")) {
                console.error("👉 Tip: You are hitting rate limits. Quota exceeded.");
            }
        }
    });
}
verify();
