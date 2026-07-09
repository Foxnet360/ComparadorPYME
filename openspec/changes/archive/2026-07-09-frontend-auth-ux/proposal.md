# Propuesta: Autenticación JWT y mejoras UX en frontend

## Contexto
El backend de ComparadorPYME ahora acepta `Authorization: Bearer <token>` para identificar usuarios. Actualmente el frontend no envía el token, por lo que el backend depende de un parche que lee `userId` desde el body/query. Esta propuesta centraliza el envío del JWT de Supabase en un cliente HTTP único y mejora la usabilidad de la matriz de coberturas.

## Objetivo
1. Crear un cliente HTTP (`services/apiClient.ts`) que adjunte automáticamente el JWT de Supabase a las peticiones al backend.
2. Refactorizar `geminiService`, `storageService` y `UnifiedCoverageMatrix` para usar ese cliente.
3. Mejorar la UX de la matriz: indicadores de confianza, tooltips enriquecidos, distinción visual de valores ausentes, sección de exclusivos, estados de carga/error y empty state.
4. Agregar tests unitarios frontend para el nuevo cliente y los flujos afectados.

## Alcance
- Cambios en frontend exclusivamente.
- No se modifica el backend.
- No se crea ni publica el PR; solo se prepara la rama `feature/frontend-auth-ux`.

## Riesgos y mitigaciones
- **Riesgo**: FormData pierde el `Content-Type` correcto si se sobreescribe.  
  **Mitigación**: El cliente elimina `Content-Type` cuando el body es `FormData`, permitiendo que el navegador establezca el boundary.
- **Riesgo**: Llamadas a `/api/...` en producción.  
  **Mitigación**: `API_BASE_URL` ya resuelve a `/api` en producción y `http://localhost:8080/api` en local; el cliente normaliza la ruta.

## Criterios de aceptación
- `apiClient.fetch` envía `Authorization: Bearer <token>` cuando existe sesión.
- En 401 redirige a `/login` y rechaza con mensaje claro.
- `geminiService` ya no envía `userId`/`userEmail` en el FormData.
- `storageService` usa `/history` sin `userId` en query string.
- La matriz muestra indicadores de confianza por celda y tooltips con nombre canónico/método.
- Exportación a Excel muestra spinner y notificación en caso de error (sin `window.alert`).
- `npm run typecheck:frontend`, `npm run lint` y tests afectados pasan.
