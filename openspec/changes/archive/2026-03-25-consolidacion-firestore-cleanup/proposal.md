# Proposal: Consolidación de Arquitectura - Limpieza Firestore

## Summary
Eliminar código muerto relacionado con Firestore y consolidar toda la arquitectura del backend en Supabase. El sistema actual tiene dos stacks operando en paralelo (Firestore legacy y Supabase nuevo), lo que genera confusión, duplicación de código y deuda técnica.

## Motivation
- **Duplicación arquitectónica**: Dos sistemas de almacenamiento (Firestore y Supabase) con lógica paralela
- **Código muerto**: Servicios y controladores de Firestore que no se usan en producción
- **Deuda técnica**: Dependencias innecesarias (`firebase-admin`) y archivos obsoletos
- **Confusión para desarrolladores**: No está claro qué stack usar para nuevas features

## Goals
- [ ] Eliminar todos los servicios relacionados con Firestore
- [ ] Eliminar controladores legacy que usan Firestore
- [ ] Migrar funcionalidad de historial de análisis de Firestore a Supabase
- [ ] Eliminar dependencia `firebase-admin` de package.json
- [ ] Limpiar scripts de test obsoletos
- [ ] Actualizar rutas API para usar solo endpoints Supabase
- [ ] Consolidar servicios duplicados de embeddings

## Non-Goals
- No migrar datos históricos de Firestore (empezar desde cero)
- No modificar funcionalidad del frontend
- No cambiar la API pública (mantener rutas existentes)
- No agregar nuevas features

## Success Criteria
- `firebase-admin` removido de package.json
- Zero referencias a Firestore en el código
- Historial de análisis funciona con Supabase
- Tests pasan después de la limpieza
- Build exitoso sin advertencias de código muerto

## Context
- **Base de datos actual**: Supabase (PostgreSQL + pgvector)
- **Stack objetivo**: Node.js + TypeScript + Express + Supabase
- **Estado actual**: Firestore está presente pero deshabilitado en producción
- **Impacto**: Solo backend, frontend sin cambios

## Open Questions
1. ¿El endpoint `/api/insurers` se usa en el frontend? (viene del controlador Firestore)
2. ¿Necesitamos mantener compatibilidad hacia atrás en alguna ruta?
3. ¿Hay algún script o proceso externo que aún use Firestore?

## Archivos a Eliminar

### Servicios
- `server/src/services/firestore.ts` (276 líneas)
- `server/src/services/clauseLibrary.ts` (277 líneas)
- `server/src/services/embeddingService.ts` (duplicado)

### Controladores
- `server/src/controllers/clauseController.ts` (135 líneas)

### Scripts
- `server/src/scripts/test_clause_library.ts`
- `server/src/scripts/test_library_analysis.ts`
- `server/src/scripts/test_section_extraction.ts`

## Archivos a Modificar

### Controladores
- `server/src/controllers/analysisController.ts`
  - Líneas 108-124: Reemplazar guardado Firestore → Supabase
  - Líneas 157-173: Reemplazar getHistory Firestore → Supabase

### Rutas
- `server/src/index.ts`: Remover rutas `/api/clauses/*` legacy

### Configuración
- `server/package.json`: Remover `firebase-admin`
- `server/.env.example`: Remover variables Firestore

## Estimación
- **Código eliminado**: ~1,000 líneas
- **Archivos borrados**: 7-8 archivos
- **Dependencias**: -1 (firebase-admin)
- **Tiempo estimado**: 1-2 días de trabajo

## Risks
- **Bajo**: Firestore ya no se usa en producción
- **Bajo**: Historial es feature secundaria
- **Medio**: Si algún script externo usa Firestore (investigar)
