# Resumen de Auditoría: Agente Comparador CSA

## 1. Visión General del Proyecto
El **Agente Comparador CSA** es una plataforma web Full-Stack diseñada para Agentes y Corredores de Seguros. Su propósito principal es automatizar el análisis, comparación y dictaminación de cotizaciones de seguros (específicamente pólizas PYME y corporativas), contrastando las condiciones particulares (Cotizaciones) contra las condiciones generales (Clausulados). 

El sistema utiliza Inteligencia Artificial Generativa (Google Gemini Advanced) como motor de RAG (Retrieval-Augmented Generation) para extraer, estructurar y evaluar los riesgos.

## 2. Pila Tecnológica (Tech Stack)
*   **Frontend**: React 19, Vite, Tailwind CSS para estilos, `recharts` para gráficos, `lucide-react` para iconos y `jspdf` / `jspdf-autotable` para la exportación de reportes profesionales.
*   **Backend**: Node.js con Express (`server/`).
*   **Procesamiento de Archivos**: `multer` para la recepción de PDFs y `pdf-parse` / `pdf-lib` para la extracción de texto crudo de los documentos.
*   **Inteligencia Artificial**: `@google/genai` (Gemini AI API) para el procesamiento de lenguaje natural y el análisis comparativo profundo.
*   **Persistencia de Datos**: 
    *   **Local (Cliente)**: IndexedDB (`idb`) a través del `storageService.ts` para emular una base de datos de usuarios, clientes, historial de análisis y estadísticas. Uso de `localStorage` para manejo rudimentario de sesiones de usuario (`seguro_app_user`).
    *   **Cloud (Servidor)**: Referencias a `firebase-admin` (Firestore) en los controladores del backend para un almacenamiento progresivo en la nube del historial de auditorías y de la biblioteca de clausulados (`clauseLibrary`).

## 3. Lógica de Negocio y Flujo de Trabajo (Workflow)

El ciclo de vida transaccional del sistema sigue 5 fases fundamentales:

### Fase 1: Configuración y Carga (Frontend)
1.  El agente inicia sesión y selecciona o crea un **Cliente** (Módulo `ClientSelector.tsx`).
2.  Sube documentos PDF/Imágenes clasificados en dos "buckets":
    *   **Cotizaciones (Input)**: Las ofertas específicas de las aseguradoras para ese cliente.
    *   **Clausulados (Librería / Upload)**: Las condiciones generales de las pólizas. Estas pueden subirse manualmente o seleccionarse desde la base de datos pre-analizada (Librería de Clausulados) para ahorrar tokens y tiempo.

### Fase 2: Ingesta y Extracción Optimizada (Backend)
1.  Los archivos llegan por `multipart/form-data` al endpoint `/api/analyze`.
2.  **Generación de Contexto (RAG)**: Se implementa una técnica de fragmentación (chunking) semántica de los Clausulados usando Inteligencia Artificial. Esto significa que los documentos legales extensos se parten en secciones indexadas (ej. exclusiones, garantías, coberturas), permitiendo a la IA recuperar y comparar objetivamente y con precisión solo el fragmento relevante contra la cotización (Retrieval-Augmented Generation).
3.  **Extracción Dinámica de Amparos**: La IA lee e interpreta ("entiende") el texto extraído de las cotizaciones para identificar dinámicamente los elementos o amparos comerciales, estructurándolos contra una tabla maestra de elementos a comparar de forma inteligente, superando la limitación de la coincidencia exacta de texto.

### Fase 3: Análisis de Inteligencia Artificial (Core Logic Eficiente)
El texto procesado y los fragmentos recuperados vía RAG se envían al modelo Gemini.
1.  **Prioridad 1 (Cotizaciones)**: Extracción profunda a JSON. Todos los datos duros (Primas, Aseguradora, Valores Asegurados, Deducibles, Amparos) son interpretados y convertidos en una estructura JSON estandarizada. Este archivo JSON intermedio se convierte en la única fuente de verdad, facilitando la comparación técnica, depuración y su envío al almacenamiento en base de datos.
2.  **Prioridad 2 (Clausulados vía RAG)**: Actúa como "Base de Conocimiento" activa. La IA "lee" el JSON de la cotización y busca las justificaciones, letras chicas o alertas en los fragmentos indexados del clausulado.

**Optimización del Stack Tecnológico**: Durante esta fase (y desde la Fase 2), el stack en el backend debe ser evaluado y refactorizado para garantizar:
*   Almacenamiento eficiente de los JSON resultantes (evitando serializaciones costosas).
*   Manejo de caché local (para documentos habituales).
*   Minimización radical del consumo de tokens en la LLM. Al usar RAG sobre los clausulados en lugar del contrato íntegro, y al obligar a un output JSON estricto, el tiempo de procesamiento y el gasto computacional decrecen exponencialmente.

### Fase 4: Estructuración del Output (Dictamen)
La IA devuelve un JSON estructurado (`ComparisonReport`) que contiene:
*   **Score general (0-100)** para cada opción, calculando la dureza del clausulado/deducibles frente el premio.
*   **Coberturas Mapeadas**: Estandarizadas de acuerdo al esquema.
*   **Análisis Bidireccional**: 
    *   *Enfoque Cliente*: Beneficios claros.
    *   *Enfoque Técnico*: Riesgos ocultos en el clausulado.
*   **Matriz de Hallazgos (Alertas)**: Marcadas como `CRITICAL` (rojo), `WARNING` (naranja) o `GOOD` (verde).
*   **Recomendación del Auditor**: Un dictamen ejecutivo de texto plano resumiendo la sugerencia proactiva del sistema.

### Fase 5: Visualización, Reporteo y Gestión (Frontend)
1.  El `ComparisonReport.tsx` renderiza las tablas comparativas y la matriz de riesgos.
2.  `pdfService.ts` genera un reporte final estético en PDF ("Resumen Ejecutivo", "Matriz Normalizada", "Análisis de Deducibles" y "Matriz de Hallazgos") para que el Agente se lo entregue al usuario final.
3.  El `storageService.ts` guarda un registro (`HistoryEntry`) con estatus de venta (DRAFT, SENT, SOLD, LOST). El `TechnicalDashboard.tsx` lee esta historia y calcula KPIs comerciales en tiempo real (Tasa de conversión, Primas Emitidas).

## 4. Hallazgos Adicionales y Áreas de Interés
*   **Cost & Token Optimization**: La introducción de la `clauseLibrary` (Librería de Clausulados) es un patrón arquitectónico inteligente. En lugar de ejecutar OCR/extracción del contrato maestro cada vez que se audita una cotización, el contrato se procesa una vez y sus "secciones relevantes" (riesgos, garantías) se inyectan dinámicamente.
*   **Fallback Administrativo**: Existen credenciales *Hardcoded* (`admin@seguros.com` / `admin123`) diseñadas lógicamente para bypass/demostraciones iniciales que deben ser mitigadas en fase de producción.
*   **Backend Híbrido**: El código en `storageService.ts` está migrando localizaciones. Intenta solicitar datos al backend (vía `import.meta.env.VITE_API_URL`), y ante errores hace fallback a la base de datos local pre-sembrada (IndexedDB). Esto es un diseño de "offline-first" o arquitectura evolutiva transicional.

---
*Análisis generado en modo Exploración de OpenSpec.*
