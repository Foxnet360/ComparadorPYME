# Proposal: Implement Document Indexing Service (Fase 2)

## Summary
Implementar el servicio completo de indexación de documentos PDF que permita:
- Subir clausulados y cotizaciones
- Extraer texto automáticamente
- Crear chunks semánticos con embeddings
- Renderizar páginas a imágenes PNG
- Almacenar todo en Supabase

## Motivation
La Fase 1 configuró la infraestructura base (Supabase, embeddings, tesauro). Ahora necesitamos el servicio que permita a los usuarios indexar sus documentos para poder hacer comparaciones y auditorías.

## Goals
- [ ] Endpoint REST para subir documentos PDF
- [ ] Extracción de texto de PDFs nativos
- [ ] Chunking semántico con metadata de coberturas
- [ ] Generación de embeddings (768 dims)
- [ ] Renderizado de páginas a PNG (evidencia visual)
- [ ] Almacenamiento en Supabase (vectores + imágenes)
- [ ] API para consultar documentos indexados
- [ ] Validación de correspondencia cotización-clausulado

## Non-Goals
- No OCR para PDFs escaneados (futuro)
- No procesamiento de imágenes incrustadas
- No manejo de archivos > 50MB
- No indexación en tiempo real masiva

## Success Criteria
- Usuario puede subir un PDF de 50 páginas
- Sistema crea chunks semánticos automáticamente
- Búsqueda por cobertura devuelve resultados relevantes
- Imágenes de páginas están disponibles públicamente
- Tiempo de indexación < 2 minutos para documento típico

## Context
- **Tecnología**: Node.js, TypeScript, Express
- **Base de datos**: Supabase (PostgreSQL + pgvector)
- **Storage**: Supabase Storage (bucket clause-pages)
- **Embeddings**: Gemini embedding-001 (768 dims)
- **Tesauro**: Normalización de términos para Colombia

## Open Questions
1. ¿Procesamos documentos sincrónicamente o en background?
2. ¿Necesitamos cola de procesamiento para múltiples archivos?
3. ¿Cómo manejamos errores parciales (algunas páginas fallan)?
