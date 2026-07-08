## Tareas: frontend-auth-ux

- [x] Crear `services/apiClient.ts` con `getAuthToken` y `apiClient.fetch`
- [x] Refactorizar `services/geminiService.ts` para usar `apiClient` y eliminar `userId`/`userEmail` del FormData
- [x] Refactorizar `services/storageService.ts` para usar `apiClient` y eliminar el query param `userId`
- [x] Actualizar `components/UnifiedCoverageMatrix.tsx` para usar `apiClient` en la exportación
- [x] Agregar indicadores de confianza por celda con color coding y tooltip numérico
- [x] Enriquecer tooltip con `canonicalName`, `matchMethod`, `notes` y `rawTextSnippet`
- [x] Aplicar estilo muted a celdas excluidas/faltantes
- [x] Agregar empty state cuando la matriz no tiene filas
- [x] Agregar spinner de carga y notificación toast en errores de exportación
- [x] Mejorar mensajes de error en `geminiService` y propagar sesión expirada
- [x] Agregar/actualizar tests para `apiClient`, `geminiService`, `storageService` y `UnifiedCoverageMatrix`
- [x] Ejecutar `npm run typecheck:frontend`, `npm run lint` y tests afectados
- [x] Crear artefactos OpenSpec en `openspec/changes/frontend-auth-ux/`

## Resumen de cambios
- Se centralizó el envío del JWT de Supabase en `services/apiClient.ts`.
- Se refactorizaron los servicios afectados para dejar de depender de `userId` en body/query.
- Se mejoró la usabilidad de la matriz de coberturas con indicadores de confianza, tooltips, estados de carga/error y empty state.
- Se agregaron tests unitarios frontend que cubren el cliente autenticado, el análisis, el historial y la matriz.
