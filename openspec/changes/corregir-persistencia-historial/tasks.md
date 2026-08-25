# Tasks: Persistencia Incondicional de Historial

## Phase 1: Modificaciones en Envo de Datos y Backend
- [ ] 1.1 Actualizar `services/geminiService.ts` para aceptar `userId` e incluirlo en `formData`.
- [ ] 1.2 Actualizar `resolveAnalysisUserId(req)` en `server/src/controllers/analysisController.ts` para tomar `req.user?.id || req.body?.userId || 'anonymous'`.

## Phase 2: Guardado Incondicional en Frontend
- [ ] 2.1 Actualizar `App.tsx` para enviar `currentUser?.id` a `analyzeQuotesWithGemini` y llamar a `storageService.saveAnalysis` incondicionalmente.
- [ ] 2.2 Actualizar `storageService.ts` en `saveAnalysis` para utilizar `currentUser?.id || 'guest'` permitiendo almacenamiento en IndexedDB.

## Phase 3: Verificación & Despliegue
- [ ] 3.1 Ejecutar suite de pruebas unitarias.
- [ ] 3.2 Compilar y desplegar en Railway.
