# Tasks: Clause Library

## 1. Backend - Modelo y Servicio

- [x] 1.1 Crear tipo `ClauseDocument` en `server/src/types.ts`
- [x] 1.2 Crear `server/src/services/clauseLibrary.ts` con operaciones CRUD
- [x] 1.3 Implementar `createClause(file, metadata)` con extracción de texto y hash
- [x] 1.4 Implementar `getClausesByInsurer(aseguradora)`
- [x] 1.5 Implementar `getClauseById(id)`
- [x] 1.6 Implementar `listInsurers()` con conteo

## 2. Backend - API Endpoints

- [x] 2.1 Crear `server/src/controllers/clauseController.ts`
- [x] 2.2 POST `/api/clauses` - Subir nuevo clausulado
- [x] 2.3 GET `/api/clauses` - Listar clausulados (con filtro por aseguradora)
- [x] 2.4 GET `/api/clauses/:id` - Obtener clausulado específico
- [x] 2.5 GET `/api/insurers` - Listar aseguradoras
- [x] 2.6 Registrar rutas en `server/src/index.ts`

## 3. Frontend - Tipos

- [x] 3.1 Crear tipo `ClauseDocument` en `types.ts`
- [x] 3.2 Crear servicio `clauseService.ts` para llamadas API

## 4. Frontend - UI Admin

- [x] 4.1 Crear `components/ClauseAdmin.tsx` con lista de clausulados
- [x] 4.2 Formulario de upload con campos: aseguradora, producto, versión
- [x] 4.3 Integrar en `App.tsx` como tab condicional (admin)

## 5. Verificación

- [x] 5.1 Probar subir clausulado y verificar en Firestore
- [x] 5.2 Probar búsqueda por aseguradora
- [x] 5.3 Probar detección de duplicados

**Notas de Verificación:**
- Script de prueba creado: `server/src/scripts/test_clause_library.ts`
- El script verifica automáticamente los 3 escenarios de prueba
- Requiere servidor backend corriendo
- Ejecutar: `cd server && npx ts-node src/scripts/test_clause_library.ts`
