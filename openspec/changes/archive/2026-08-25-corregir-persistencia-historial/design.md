# Design: Persistencia Universal de Historial de Comparaciones

## Component & Service Changes

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant App as App.tsx
    participant Gemini as geminiService.ts
    participant Backend as analysisController.ts
    participant Repo as analysisRepository (Supabase)
    participant LocalDB as storageService (IndexedDB)

    Usuario->>App: Clic en "Iniciar Comparación"
    App->>Gemini: analyzeQuotesWithGemini(files, client, domain, userId)
    Gemini->>Backend: POST /api/analyze (FormData + userId)
    Backend->>Repo: saveAnalysisHistory(payload with user_id)
    Repo-->>Backend: Devuelve UUID grabado
    Backend-->>Gemini: Devuelve JSON con ID asignado
    Gemini-->>App: ComparisonReport con ID
    App->>LocalDB: storageService.saveAnalysis(clientName, report) [SIEMPRE]
    LocalDB-->>App: Guardado en IndexedDB local
    App-->>Usuario: Muestra reporte e historial actualizado
```

### 1. `services/geminiService.ts`
- Agregar parámetro opcional `userId?: string`.
- Si `userId` está presente, enviarlo en `formData.append('userId', userId)`.

### 2. `server/src/controllers/analysisController.ts`
- Actualizar `resolveAnalysisUserId(req)`:
  ```ts
  export function resolveAnalysisUserId(req: AuthenticatedRequest): string {
    return req.user?.id || (req.body?.userId as string) || 'anonymous';
  }
  ```

### 3. `App.tsx`
- Pasar `currentUser?.id` al invocar `analyzeQuotesWithGemini`.
- Llamar incondicionalmente a `storageService.saveAnalysis(clientName, result, selectedClient?.id)`.

### 4. `services/storageService.ts`
- En `saveAnalysis`, usar `currentUser?.id || 'guest'` para que nunca se aborte la persistencia local.
