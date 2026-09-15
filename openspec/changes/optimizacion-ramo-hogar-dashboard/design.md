# Design: Optimización del Ramo Hogar, Matriz de Coberturas y Dashboard de Brechas

## Architecture Overview

```
               Uploaded Quotes (PDFs)
                         │
                         ▼
        ┌──────────────────────────────────┐
        │   unifiedComparisonEngine.ts     │
        │   (domain: 'hogar' aware)        │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  comparisonPromptBuilder.ts      │
        │  - Secciones Hogar (Taxonomía)   │
        │  - Resolución % -> Moneda real   │
        │  - Aislamiento Aseguradora pura  │
        │  - Tipología Hogar & Deducibles  │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │      Gemini 3.7 Flash V2         │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  analysisController.ts           │
        │  - Sanitizador de aseguradoras   │
        │  - isRagAvailable dinámico       │
        └────────────────┬─────────────────┘
                         │
                         ▼
       ┌─────────────────┴─────────────────┐
       ▼                                   ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│ ReportCharts & Matrix     │    │ Letra Chica y Brechas     │
│ - ResponsiveContainer fix │    │ - Rebranded UI            │
│ - Limpieza cabeceras      │    │ - Risk Chart fix          │
│ - "No Cotizado" vs "Sin D"│    │ - Enriquecimiento RAG     │
└───────────────────────────┘    └───────────────────────────┘
```

## Key Decisions

1. **Recharts Container Architecture:**
   - `<DeferredChart>` debe actuar como envoltorio de ciclo de vida (observa con `ResizeObserver` hasta tener tamaño positivo), pero **debe contener `<ResponsiveContainer width="100%" height="100%">`** inmediatamente alrededor de `<RadarChart>` o `<BarChart>`.
   - Esto resuelve de inmediato la pantalla en blanco en `ReportCharts` y `AuditDashboard`.

2. **Sanitización de Aseguradoras a Doble Nivel:**
   - **Nivel Prompt:** Regla explícita en `comparisonPromptBuilder`: `insurers` es un array estricto con nombres como `ALLIANZ`, `SURA`, `SBS`.
   - **Nivel Backend:** Función helper `extractCanonicalInsurerName(raw: string)` que detecta marcas de aseguradoras colombianas mediante expresiones regulares y elimina nombres de clientes (`ISABEL CRISTINA...`) y nombres de ramos (`HOGAR`, `PYME`, `TODO RIESGO`).

3. **Estrategia Dedicada para Hogar (`hogarPromptStrategy`):**
   - No usar más `pymePromptStrategy` como fallback para Hogar.
   - Definir secciones granulares de Hogar basadas en `data/domains/hogar/taxonomy.json`:
     - BIENES ASEGURADOS: Edificio, Contenidos, Contenidos Especiales, Equipo Eléctrico y Electrónico.
     - COBERTURAS: Amparo Básico (Incendio y Aliados), Terremoto/Temblor, Daños por Agua/Anegación, Granizo/Vendaval, Sustracción con Violencia, RCE Familiar, Asistencia Domiciliaria.
     - DEDUCIBLES: Deducibles específicos por amparo.

4. **Regla de Conversión Porcentual:**
   - Para aseguradoras como SURA que describen coberturas como `100%`:
   - El prompt indicará: *"Si una cotización expresa el amparo como un porcentaje (ej. '100%'), calcula el valor absoluto en pesos multiplicando dicho porcentaje por el valor del bien asegurado correspondiente (Edificio o Contenidos) y muéstralo como '$XXX.XXX.XXX (YY%)'".*

5. **Rebranding y Valor Consciente de Auditoría:**
   - Cambiar los textos de cara al usuario de *"Auditoría de Riesgos"* a *"Análisis de Letra Chica y Brechas"*.
   - Presentar un resumen ejecutivo explicativo: *"Detecta vacíos de protección, garantías obligatorias y cláusulas limitativas que no figuran en la carátula comercial de la cotización"*.
