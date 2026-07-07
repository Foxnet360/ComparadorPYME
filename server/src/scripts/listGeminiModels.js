/**
 * Script para listar modelos disponibles en Gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = 'AIzaSyD3LOshQxEY4swacCat1VnlVuGj8WviWAU';

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
