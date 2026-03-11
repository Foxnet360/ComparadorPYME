# Agente Comparador CSA - Documentación del Proyecto

## 1. Visión General
**Agente Comparador CSA** es una aplicación web progresiva (SPA) diseñada para el sector asegurador. Su objetivo principal es automatizar el análisis técnico, comparativo y auditoría de cotizaciones de seguros (Ramo PYME/Multirriesgo) utilizando Inteligencia Artificial Generativa.

La herramienta permite a los analistas técnicos cargar archivos PDF/Imágenes de cotizaciones y clausulados, extrayendo datos estructurados para generar tableros de decisión, matrices de cobertura y reportes PDF listos para el cliente.

### Características Clave
*   **Análisis Multimodal:** Procesa texto e imágenes (PDFs, capturas) simultáneamente.
*   **Gemini 3.0 Pro Reasoning:** Utiliza modelos con capacidad de "pensamiento" (`thinkingBudget`) para deducciones complejas sobre garantías y exclusiones.
*   **Scoring Multidimensional:** Califica ofertas basándose en 6 vectores (Cobertura, Deducibles, Exclusiones, Precio, Sublímites, Garantías).
*   **Persistencia Local:** Gestión de historial y métricas de negocio almacenadas en `localStorage` (Arquitectura Serverless/Client-side).
*   **Generación de Reportes:** Exportación a PDF con tablas comparativas normalizadas.

---

## 2. Stack Tecnológico

### Frontend
*   **Framework:** React 19 (Component-Based Architecture).
*   **Lenguaje:** TypeScript (Tipado estricto para modelos de datos de seguros).
*   **Estilos:** Tailwind CSS (Utility-first).
*   **Iconografía:** Lucide React.
*   **Visualización de Datos:** Recharts (Gráficos de área, barras y radar).

### IA & Backend Services
*   **Modelo AI:** Google Gemini 3.0 Pro Preview.
*   **SDK:** `@google/genai` (Google GenAI SDK para Web).
*   **Procesamiento de Documentos:** Inferencia directa multimodal (sin OCR intermedio externo).
*   **Generación PDF:** `jspdf` y `jspdf-autotable`.

---

## 3. Configuración e Instalación

### Requisitos Previos
*   Node.js v18+
*   API Key de Google AI Studio con acceso a modelos `preview`.

### Pasos
1.  Clonar el repositorio.
2.  Instalar dependencias:
    ```bash
    npm install
    ```
3.  Configurar variables de entorno (o inyección directa en el proceso de build):
    ```env
    API_KEY=tu_api_key_de_google
    ```
4.  Ejecutar entorno local:
    ```bash
    npm run dev
    ```

---

## 4. Estructura del Proyecto
(Ver `ARCHITECTURE.md` para detalles de flujo de datos).

*   `/components`: UI reutilizable (Tablas, Uploaders, Dashboards).
*   `/services`: Lógica de negocio, llamadas a API y persistencia.
*   `/types`: Definiciones de interfaces TypeScript (Contratos de datos).
*   `/documentation`: Documentación técnica.
