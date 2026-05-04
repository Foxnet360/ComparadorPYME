import { ComparisonReport } from "../types";
import { API_BASE_URL } from "./apiConfig";


export const analyzeQuotesWithGemini = async (
  quoteFiles: File[],
  clauseFiles: File[],
  clientName: string,
  onStatusUpdate?: (status: string) => void,
  clauseIds?: string[] // NEW: Support for clause IDs from library
): Promise<ComparisonReport> => {

  const formData = new FormData();
  formData.append('clientName', clientName);

  // Add User Metadata from LocalStorage
  const user = localStorage.getItem('seguro_app_user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed.id) formData.append('userId', parsed.id);
      if (parsed.email) formData.append('userEmail', parsed.email);
    } catch (e) {
      console.warn("Failed to parse user from storage", e);
    }
  }

  if (onStatusUpdate) onStatusUpdate("Preparando archivos para envío...");

  quoteFiles.forEach(file => formData.append('quotes', file));

  // NEW: Use clauseIds from library if provided, otherwise use uploaded files
  if (clauseIds && clauseIds.length > 0) {
    formData.append('clauseIds', JSON.stringify(clauseIds));
    if (onStatusUpdate) onStatusUpdate("Usando clausulados de biblioteca (optimizado)...");
  } else {
    clauseFiles.forEach(file => formData.append('clauses', file));
  }


  if (onStatusUpdate) onStatusUpdate("Subiendo archivos al servidor seguro (Cloud Run)...");

  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Could not parse JSON, stick to statusText
      }
      throw new Error(errorMessage);
    }

    if (onStatusUpdate) onStatusUpdate("Procesando con Gemini Advanced (RAG)...");

    const result = await response.json();
    return result as ComparisonReport;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

export interface ChatSession {
  sendMessageStream: (params: { message: string }) => AsyncIterableIterator<any>;
}

export const createChatSession = (reportContext?: any): ChatSession | null => {
  return {
    sendMessageStream: async function* ({ message }: { message: string }) {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          reportContext,
          useRAG: true
        })
      });

      if (!response.ok) {
        throw new Error(`Chat error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Yield the response in the expected format
      yield {
        text: result.text,
        citations: result.citations
      };
    }
  };
};