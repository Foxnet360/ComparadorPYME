# RAG Architecture Optimization

## Why
El proceso actual de evaluación de seguros (Fase 2 y Fase 3) envía contratos completos y cotizaciones crudas al LLM (Gemini Advanced). Esto genera tres problemas fundamentales:
1. **Consumo excesivo de tokens**: Enviar PDFs íntegros en cada petición eleva los costos y el tiempo de respuesta geométricamente.
2. **Comparaciones Rígidas**: La extracción de amparos depende de coincidencias de texto más exactas, impidiendo comparaciones semánticas fluidas donde un mismo amparo puede llamarse distinto entre aseguradoras.
3. **Escalabilidad y Persistencia**: Los resultados carecen de una fuente de verdad dura estructurada antes del dictamen final, dificultando depurar, validar y almacenar métricas moleculares.

## What Changes
Implementaremos una arquitectura orientada a Retrieval-Augmented Generation (RAG) y estructuración JSON rígida:
1. **Fragmentación (Chunking) Semántica de Clausulados**: Los contratos y clausulados base (Librería de Clausulados) se segmentarán y vectorizarán/indexarán previamente. La IA recuperará únicamente la "letra chica" (exclusiones, garantías) del fragmento pertinente a la cotización evaluada.
2. **Entendimiento Dinámico de Amparos**: Modificar el prompt de ingesta para que la IA extraiga los amparos de las cotizaciones basándose en su interpretación semántica frente a un catálogo maestro (Plantilla PYME), no en mera coincidencia de cadenas.
3. **Output JSON Intermedio Orientado a Backend**: La Fase 3 se refactorizará para forzar que el modelo exporte todos los "datos duros" (Primas, Aseguradoras, Deducibles, Amparos estructurados) en un formato JSON estándar. Este JSON se almacenará eficientemente, usará caché y servirá como insumo para el front-end y el dictamen final, reduciendo la serialización pesada.

## Capabilities
- Amparo Semantic Extraction
- RAG Clause Chunking
- JSON Intermediary Store

## Impact
- Reducción proyectada del uso de tokens (y costos asociados) al no alimentar contratos enteros en la ventana de contexto del LLM.
- Reducción del tiempo de respuesta del dictamen.
- Mayor precisión objetiva al abstraer los nombres comerciales a conceptos estandarizados (Amparo Semántico).
- Bases sentadas para analítica de datos a nivel de coberturas, facilitando dashboards de Business Intelligence en iteraciones futuras.
