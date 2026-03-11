# Implement RAG Architecture

## Why

El sistema actual de comparación de seguros tiene tres problemas críticos no resueltos: (1) la extracción de texto de PDFs no funciona correctamente, (2) el análisis con Gemini está roto y requiere reemplazo, y (3) no existe arquitectura RAG, enviando documentos completos al LLM con costos excesivos de tokens. Este cambio implementará una arquitectura RAG completa con Groq como LLM, extracción de texto funcional, y chunking semántico para optimizar costos y mejorar la precisión.

## What Changes

- Reemplazar Gemini por Groq (Llama 3.1) como motor de análisis LLM
- Implementar extracción de texto de PDFs funcional usando pdf-lib
- Crear sistema de chunking semántico para clausulados legales (jerárquico por CAPÍTULO > SECCIÓN > NUMERAL)
- Implementar almacenamiento vectorial con ChromaDB para recuperación RAG
- Configurar pipeline RAG completo: ingest → chunk → embed → store → retrieve → analyze
- Desplegar backend en Railway con presupuesto de $5-12/mes

## Capabilities

### New Capabilities

- **pdf-text-extraction**: Extracción de texto nativo de PDFs usando pdf-lib con limpieza de formato
- **semantic-chunking**: Chunking jerárquico de documentos legales basado en estructura (capítulos, secciones, numerales) con fallback LLM para documentos sin estructura
- **vector-storage**: Almacenamiento vectorial en ChromaDB con metadatos (aseguradora, documento, sección)
- **rag-retrieval**: Sistema de recuperación RAG que busca chunks relevantes por cobertura/amparo
- **groq-analysis**: Análisis de cotizaciones usando Groq (Llama 3.1) con contexto RAG de clausulados
- **clause-library-management**: Gestión de la librería de clausulados (upload, chunking, indexación)

### Modified Capabilities

- **clause-analysis**: Cambia de Gemini (roto) a Groq para el análisis de cláusulas y comparación de coberturas

## Impact

- **Backend**: Nuevo pipeline RAG en `server/src/services/`
- **APIs**: Nuevos endpoints para gestión de clausulados y retrieval RAG
- **Dependencies**: groq, @xenova/transformers (embeddings), chromadb
- **Frontend**: Actualizar componentes para mostrar citations con referencias de página/sección
- **Infraestructura**: Deploy en Railway ($5/mes)
