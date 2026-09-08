/**
 * Script para listar modelos disponibles en Gemini
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY es requerida.');
  console.error('Definila en .env.local o en el entorno antes de ejecutar este script.');
  process.exit(1);
}

async function listModels() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
    );
    const data = await response.json();

    console.log('Modelos disponibles:\n');
    data.models.forEach((model) => {
      console.log(`- ${model.name}`);
      console.log(`  Display: ${model.displayName}`);
      console.log(`  Supported: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
