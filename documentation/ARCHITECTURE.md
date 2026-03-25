# Arquitectura de Software

## 1. Patrón de Diseño
La aplicación sigue una arquitectura **SPA (Single Page Application)** basada en componentes funcionales de React. El estado se gestiona localmente mediante Hooks (`useState`, `useEffect`) y se persiste una capa de datos ligera en el navegador.

### Diagrama de Alto Nivel
```mermaid
graph TD
    User[Usuario Técnico] -->|Sube Archivos| UI[Interfaz React]
    UI -->|Archivos + Prompt| Service[Gemini Service]
    Service -->|Request Multimodal| GenAI[Google Gemini API]
    GenAI -->|JSON Estructurado| Service
    Service -->|Objeto Reporte| State[App State]
    State -->|Render| Dashboard[Dashboard Técnico]
    State -->|Save| Storage[Storage Service (LocalStorage)]
    Dashboard -->|Export| PDF[PDF Service]
```

## 2. Módulos Principales

### A. Módulo de Autenticación (`LoginScreen.tsx`, `storageService.ts`)
*   **Responsabilidad:** Control de acceso simulado para roles (Técnico/Admin).
*   **Mecanismo:** Validación contra credenciales hardcoded (para MVP) y almacenamiento de sesión en `localStorage`.

### B. Motor de Análisis (`geminiService.ts`)
*   **Responsabilidad:** Orquestar la comunicación con la IA.
*   **Entrada:** `File[]` (Cotizaciones) + `File[]` (Clausulados).
*   **Proceso:**
    1.  Conversión de archivos a Base64.
    2.  Construcción de `FileParts` para la API.
    3.  Inyección del `SYSTEM_INSTRUCTION` y `Schema` JSON.
    4.  Llamada a `ai.models.generateContent`.
*   **Salida:** Objeto `ComparisonReport` validado.

### C. Sistema de Visualización (`ComparisonReport.tsx`)
*   **Responsabilidad:** Renderizar datos complejos de forma legible.
*   **Sub-componentes:**
    *   **Resumen:** Gráficos Radar (Cualitativo) y Barras (Precios).
    *   **Matriz:** Tabla comparativa normalizada (busca coincidencias de strings difusas).
    *   **Auditoría:** Lista de alertas clasificadas por severidad.

### D. Persistencia (`storageService.ts`)
*   **Responsabilidad:** Guardar historial de cotizaciones y estadísticas.
*   **Estrategia:** `JSON.stringify` en LocalStorage. Incluye lógica para calcular KPIs (Tasa de cierre, primas vendidas) filtrando por fecha actual.

## 3. Flujo de Datos y Tipado

El proyecto utiliza **TypeScript** estrictamente. Los tipos principales se definen en `types.ts`.

*   **Entidad Core:** `QuoteAnalysis`
    *   Contiene toda la información de una aseguradora específica (precios, coberturas normalizadas, desglose de puntaje).
*   **Entidad Reporte:** `ComparisonReport`
    *   Agrupa múltiples `QuoteAnalysis` y añade análisis de mercado global y recomendaciones.

## 4. Consideraciones de Seguridad
*   **Datos Sensibles:** Actualmente, los archivos se procesan en memoria y se envían a Google AI. No se almacenan archivos en servidores intermedios.
*   **API Key:** Se debe asegurar que la `API_KEY` no se exponga en el cliente en entornos productivos públicos (se recomienda usar un Proxy Backend para producción real).
