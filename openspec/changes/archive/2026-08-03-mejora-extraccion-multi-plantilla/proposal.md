## Why

Las cotizaciones de seguros en Colombia (PYME, Autos, Copropiedades, Salud, Cumplimiento, Transporte, Vida) presentan una alta heterogeneidad visual y estructural entre aseguradoras (Suramericana, AXA Colpatria, Mapfre, SBS, Bolívar, etc.). La extracción directa de textos planos mediante un único prompt masivo genera pérdida de relaciones espaciales (coberturas desalineadas de deducibles), saturación del contexto de la IA y fallos de reconciliación matemática.

Este cambio introduce un pipeline de extracción multi-plantilla y resiliente al layout, estructurando el proceso en fases de clasificación espacial, segmentación temática, fingerprinting por aseguradora, extracción multi-paso y validación determinística.

## What Changes

- **Análisis Previo de Layout y Clasificación Espacial**: Análisis de cajas delimitadoras (bounding boxes) y estructura visual previa para reconstruir tablas y mantener relaciones relativas Cobertura ↔ Suma Asegurada ↔ Deducible.
- **Enrutamiento Temático de Páginas (Page Router & Chunking)**: Identificación y filtrado inteligente de las páginas críticas (Carátula, Resumen de Primas, Tabla de Amparos, Deducibles) para omitir clausulados extensos e irrelevantes.
- **Registro de Plantillas y Fingerprinting de Aseguradoras**: Detección automática de firmas visuales/textuales por aseguradora e inyección de prompts few-shot especializados.
- **Pipeline de Extracción Multi-Paso**: Extracción modular dividida en 3 micro-pasos (Primas/Encabezado → Coberturas → Deducibles/Normatividad) y posterior fusión.
- **Procesamiento Posterior Determinístico y Reconciliación**: Validación de suma matemática (`netPremium + taxes + fees == totalPayable`) y verificación de integridad de deducibles obligatorios con autoprotección por re-prompt.

## Capabilities

### New Capabilities
- `multi-template-extraction`: Sistema de extracción y mapeo multi-plantilla resiliente a variaciones de layout visual y estructural para cotizaciones del mercado colombiano.

### Modified Capabilities
- N/A

## Impact

- **Servicios Afectados**: `server/src/services/unifiedComparison/`, `promptStrategyFactory.ts`, extractor unificado de PDFs y cargador de bundles de dominio.
- **API**: Mantenimiento estricto del contrato `InsuranceAnalysisResult` existente sin cambios rompedores.
- **Dependencias**: Integración con Engram para persistencia de patrones de plantilla y motor de orquestación Gentle AI.
