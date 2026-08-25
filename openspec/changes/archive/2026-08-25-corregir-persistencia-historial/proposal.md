# Proposal: Garantizar Persistencia Universal de Historial de Comparaciones (Backend & Frontend IndexedDB)

## Intent
Corregir la falla por la cual las comparaciones ejecutadas no quedaban grabadas en el historial. Asegurar que toda comparación efectuada (sea por usuario autenticado, usuario demo o visitante) se persista de forma infalible tanto en Supabase (`analysis_history`) como en el almacenamiento local del navegador (`IndexedDB`).

## Scope

### 1. Inclusión de `userId` en FormData y `resolveAnalysisUserId` (`services/geminiService.ts` & `server/src/controllers/analysisController.ts`)
- Enviar `userId` del usuario activo en `formData` dentro de `geminiService.ts`.
- Actualizar `resolveAnalysisUserId(req)` en el backend para extraer `req.user?.id || req.body?.userId || 'anonymous'`.

### 2. Guardado Incondicional en Frontend (`App.tsx` & `storageService.ts`)
- Eliminar el condicional `if (currentUser)` en `App.tsx` que impedía llamar a `storageService.saveAnalysis` cuando la sesión era local o demo.
- Asegurar que `storageService.saveAnalysis` asigne un usuario por defecto (`currentUser?.id || 'guest'`) para almacenar el reporte completo en IndexedDB.

### 3. Recuperación de Historial Resiliente (`storageService.ts` & `analysisRepository.ts`)
- Permitir que el historial consulte y fusione registros tanto de la nube (`/api/history`) como de la caché local cuando la API responda vacío o sin credenciales.

## Success Criteria
- 100% de las comparaciones realizadas generan una entrada en el historial con ID válido.
- La pantalla de historial y el panel técnico muestran inmediatamente la comparación recién terminada.
- Funcionamiento idéntico tanto para usuarios registrados como para usuarios de prueba rápida.
