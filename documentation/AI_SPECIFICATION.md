# Especificación de Ingeniería de IA

Este documento detalla cómo el Agente Comparador CSA interactúa con el modelo LLM para garantizar resultados deterministas y técnicos.

## 1. Configuración del Modelo

*   **Modelo:** `gemini-3-pro-preview`
*   **Justificación:** Se requiere el modelo "Pro" por su ventana de contexto amplia (para leer clausulados extensos) y su capacidad de razonamiento superior para interpretar jerga legal de seguros.
*   **Configuración de Pensamiento (`Thinking Budget`):** `32768 tokens`.
    *   Se habilita el "Pensamiento" para permitir que el modelo reflexione sobre las condiciones ocultas (letra chica) antes de emitir un puntaje.

## 2. Estrategia de Prompting

El sistema utiliza una estrategia de **Chain-of-Thought (CoT)** implícita guiada por instrucciones estructuradas definidas en `constants.ts`.

### Fases del System Instruction:

1.  **Fundamentación (Grounding):**
    *   Instrucción: Buscar evidencias en los archivos adjuntos.
    *   Herramienta: `googleSearch` habilitado como respaldo si el clausulado no está adjunto.

2.  **Mapeo Estricto (Normalización):**
    *   El modelo recibe una lista `PLANTILLA_ITEMS` (ej: "Lucro Cesante", "RCE").
    *   **Restricción:** El modelo *debe* extraer los valores de las pólizas y mapearlos a estos nombres exactos. Esto permite generar la tabla comparativa "lado a lado" en el Frontend.

3.  **Scoring Algorítmico (Simulado):**
    *   Se instruye al modelo para actuar como un actuario/auditor.
    *   Fórmula: `(Cob*25% + Ded*20% + Exc*20% + Precio*15% + Sub*10% + Gar*10%) * 10`.
    *   El modelo evalúa cualitativamente cada vector y asigna un valor numérico (1-10).

4.  **Generación de Alertas:**
    *   Clasificación semántica de hallazgos en niveles: `CRITICAL`, `WARNING`, `GOOD`.

## 3. Schema de Salida (Structured Output)

Para garantizar que el Frontend no falle, forzamos una salida JSON estricta (`responseMimeType: "application/json"`).

### Estructura JSON Clave:
```typescript
interface QuoteAnalysis {
  insurerName: string;
  priceAnnual: number;
  coverages: { name: string; value: string }[]; // Debe coincidir con Plantilla
  scoringBreakdown: {
    coverage: number;
    deductibles: number;
    // ... otros factores
  };
  alerts: {
    level: 'CRITICAL' | 'WARNING' | 'GOOD';
    title: string;
    description: string;
  }[];
}
```

## 4. ChatBot Contextual

*   **Técnica:** RAG Contextual (Retrieval-Augmented Generation simplificado).
*   **Implementación:**
    1.  Se realiza el análisis inicial.
    2.  El JSON resultante se inyecta como "Contexto del Sistema" en una nueva sesión de chat (`ai.chats.create`).
    3.  El usuario hace preguntas sobre ese contexto específico.
