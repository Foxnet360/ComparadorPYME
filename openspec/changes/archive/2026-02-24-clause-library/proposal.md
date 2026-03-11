# Biblioteca de Clausulados

## Why

Los clausulados son documentos estáticos (cambian ~1 vez/año) pero se reprocesan en cada análisis, desperdiciando tokens de IA. Con ~20 clausulados por aseguradora, indexarlos una vez permite reutilizarlos infinitamente.

## What Changes

- Modelo de datos en Firestore para almacenar clausulados pre-procesados
- UI de administración para subir/gestionar clausulados
- API para consultar clausulados por aseguradora/producto

## Capabilities

### New Capabilities

- `clause-storage`: Almacenamiento estructurado de clausulados en Firestore
- `clause-admin-ui`: Interfaz para gestionar la biblioteca de clausulados
- `clause-lookup`: API para buscar clausulados por aseguradora/producto

## Impact

- `server/src/services/clauseLibrary.ts`: [NEW] Servicio de biblioteca
- `server/src/controllers/clauseController.ts`: [NEW] API endpoints
- `server/src/types.ts`: Añadir tipos ClauseDocument
- `components/ClauseAdmin.tsx`: [NEW] UI de administración

## Out of Scope

- Extracción automática de secciones (siguiente change)
- Integración con análisis de cotizaciones (change 3)
